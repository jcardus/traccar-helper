<template>
  <div style="padding: 20px">
    <div id="loader" v-if="loading"></div>
    <div>
      <img height="44" :src="`/img/logos/${host}.png`" alt="logo">
    {{this.session && this.session.email}}
    <br/>
    <p>
    </p>
    {{geofences.length}} geofences:
    <button @click="showGeofences=!showGeofences">{{showGeofences?'Hide':'Show'}}</button>
    <button @click="selectedGeofences = geofences.map(g => g.id)">Select all</button>
    <ol v-if="showGeofences">
      <li v-for="d of geofences" :key="d.id" @click="toggleSelectedGeofence(d.id)"
          :style="selectedGeofences.includes(d.id)?'background-color: yellow':''">{{d.name}} {{d.attributes}} {{d.area}}</li>
    </ol>
    <p></p>
      <div v-if="false">
    {{groups.length}} groups:
    <button @click="showGroups=!showGroups">{{showGroups?'Hide':'Show'}}</button>
    <ol v-if="showGroups">
      <li v-for="d of groups" :key="d.id"
          :style="selectedGroups.includes(d.id)?'background-color: yellow':''">group {{d}}</li>
    </ol>
      </div>
    <p></p>
    <input @click="removeGeofences" :value="`Delete selected (${selectedGeofences.length})`" type="button">
    <p></p>
    <input @click="removeDuplicated" value="Delete duplicated" type="button">
    <p></p>
      <div>
        <div style="border-bottom: solid #3498db;padding: 10px">
    Add Geofence from GeoJSON:<br>
    <input ref="file" type="file" @change="addGeofence"><input type="checkbox" id="flip" v-model="flip"><label for="flip">Flip coordinates</label><br>
    <p></p>
        </div>
        <div style="border-bottom: solid #3498db;padding: 10px">
    Add Geofences from CSV<br>
    format: code;name;latitude;longitude<br>
    <input ref="csv" type="file" @change="addGeofencesFromCSV">
          <input type="submit" @click="addGeofencesFromCSV">
    <p></p>
          </div><div style="border-bottom: solid #3498db;padding: 10px">
    Add Geofences from KML<br>
    <input ref="kmz" type="file" @change="addGeofencesFromKMZ">
    <p></p></div>
        </div>
      <div v-if="false">
    {{devices.length}} devices:
    <button @click="showDevices=!showDevices">{{showDevices?'Hide':'Show'}}</button>
    <button @click="getComputed">Get Computed</button>
    <ol v-if="showDevices">
      <li v-for="d of devices" :key="d.id">{{d.name}}<p>{{d}}</p>
        <p>COMPUTED: {{d.computed && d.computed.map(c => c.description).join(',')}}</p>
      </li>
    </ol>
    <input type="button" value="Add Device" @click="addDevice">
    <p></p>
      </div>
    <div v-if="false">
      <textarea v-model="expression"></textarea>
      <input type="text" v-model="deviceId">
      <input type="button" value="Test Computed" @click="testComputed">
    </div>
    <p>
    <progress id="progress" :value="progress" :max="max" style="width: 100%"/><br>{{progress}}/{{max}} ({{(progress/max*100).toFixed(1)}}%)
      {{log}}
    </p>
    <div>
      updated: {{updated}}<br>
      inserted: {{inserted}}<br>
      ignored: {{ignored}}<br>
      error: {{error}}
    </div>
    <textarea readonly v-model="lastError" style="width: 100%; height: 100px"/>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { stringify } from 'wellknown'
import kmlParser from 'js-kml-parser'

export default {
  name: 'IndexPage',
  data () {
    return {
      flip: true,
      lastError: '',
      error: 0,
      max: 0,
      updated: 0,
      inserted: 0,
      ignored: 0,
      progress: 0,
      deviceId: 0,
      userId: 0,
      expression: '',
      file: null,
      showDevices: false,
      showGroups: false,
      showGeofences: false,
      selectedGeofences: [],
      selectedGroups: [],
      log: ''
    }
  },
  computed: {
    ...mapGetters(['session', 'devices', 'geofences', 'groups', 'loading']),
    host: () => window.location.hostname
  },
  methods: {
    testComputed () {
      this.$axios.$post('attributes/computed/test?deviceId=' + this.deviceId, { expression: this.expression, type: 'string' })
    },
    toggleSelectedGeofence (g) {
      if (this.selectedGeofences.includes(g)) {
        this.selectedGeofences.splice(this.selectedGeofences.indexOf(g), 1)
      } else {
        this.selectedGeofences.push(g)
      }
    },
    getComputed () {
      this.$store.dispatch('getComputed')
    },
    addDevice () {
      this.$store.dispatch('addDevice', prompt('Device name?'))
    },
    async removeGeofences () {
      if (confirm('Delete ' + this.selectedGeofences.length + ' geofences?')) {
        this.$store.commit('SET_LOADING', true)
        await this.$store.dispatch('removeGeofences', this.selectedGeofences)
        this.$store.commit('SET_LOADING', false)
      }
    },
    async removeDuplicated () {
      const toRemove = []
      this.geofences.forEach((g, i, a) => {
        if (g !== a.find(e => e.name === g.name)) {
          console.log(`will remove ${g.name}`)
          this.lastError += `will remove ${g.name}`
          toRemove.push(g)
        }
      })
      console.log('found', toRemove.length, 'duplicates')
      for (const g of toRemove) {
        console.log('removing', g.name)
        await this.$store.dispatch('removeGeofence', g.id)
      }
    },
    addGeofence () {
      const name = prompt('Name?')
      this.file = this.$refs.file.files[0]
      const reader = new FileReader()
      reader.onload = async (res) => {
        try {
          this.$store.commit('SET_LOADING', true)
          const content = JSON.parse(res.target.result)
          for (const feature of content.features) {
            let area
            switch (feature.geometry.type) {
              case 'Point':
                area = `CIRCLE (${feature.geometry.coordinates[this.flip ? 1 : 0].toFixed(6)} ${feature.geometry.coordinates[this.flip ? 0 : 1].toFixed(6)}, 100)`
                break
              case 'LineString':
                if (this.flip) {
                  feature.geometry.coordinates = feature.geometry.coordinates.map(c => [c[1].toFixed(6), c[0].toFixed(6)])
                }
                area = stringify(feature)
                break
              case 'Polygon':
                if (this.flip) {
                  feature.geometry.coordinates[0] = feature.geometry.coordinates[0].reverse().map(c => [c[1].toFixed(6), c[0].toFixed(6)])
                }
                area = stringify(feature).replace('POLYGON (', 'POLYGON(')
                break
              default:
                area = stringify(feature)
                alert(`Can not handle ${feature.geometry.type}, coordinates were not flipped.`)
            }
            await this.$store.dispatch('addGeofence', { name, area })
            alert(`${name} inserted!`)
          }
        } catch (e) {
          console.error(e)
          alert(e.message)
        }
        this.$store.commit('SET_LOADING', false)
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },
    addGeofencesFromKMZ () {
      this.file = this.$refs.kmz.files[0]
      const reader = new FileReader()
      reader.onload = async () => {
        const geoJson = kmlParser.toGeoJson(reader.result)
        console.log(geoJson)
        this.max = geoJson.features.length
        for (const feature of geoJson.features) {
          const name = feature.properties.name
          if (feature.geometry.type !== 'Polygon') {
            const area = `CIRCLE (${feature.geometry.coordinates[1]} ${feature.geometry.coordinates[0]}, 100)`
            await this.processGeofence(name, area, feature.geometry.coordinates[1], feature.geometry.coordinates[0])
          } else {
            const area = `POLYGON((${feature.geometry.coordinates.map(c => c[0] + ' ' + c[1]).join(',')}))`
            await this.processPolygon(name, area)
          }
        }
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },
    reset () {
      this.error = 0
      this.inserted = 0
      this.error = 0
      this.max = 0
      this.updated = 0
      this.inserted = 0
      this.ignored = 0
      this.progress = 0
      this.log = ''
      this.lastError = ''
    },
    addGeofencesFromCSV () {
      this.file = this.$refs.csv.files[0]
      if (!this.file) {
        alert('Select file')
        return
      }
      this.$store.commit('SET_LOADING', true)
      this.reset()
      const reader = new FileReader()
      reader.onload = async (res) => {
        try {
          const content = res.target.result
          const lines = content.split('\n')
          this.max = lines.length
          for (const line of lines) {
            if (!line.length) {
              continue
            }
            const fields = line.split(';')
            const area = `CIRCLE (${fields[2]} ${fields[3]}, 100)`
            const name = fields[0] + ' - ' + fields[1]
            await new Promise(resolve => requestIdleCallback(resolve))
            await this.processGeofence(name, area, fields[2], fields[3])
          }
          await this.$store.dispatch('bulkInsert')
        } catch (e) {
          alert(e.message)
        }
        this.$store.commit('SET_LOADING', false)
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },
    async processPolygon (name, area) {
      this.progress++
      try {
        console.log(name, area)
        await this.$store.dispatch('addGeofence', { name, area })
        await this.$store.dispatch('bulkInsert')
        this.log = `inserted ${name}`
        this.inserted++
      } catch (e) {
        console.error(e)
        this.error++
        this.lastError += `${name} -> ${(e.response && e.response.data) || e.message}`
      }
    },
    async processGeofence (name, area, lat, lon) {
      this.progress++
      try {
        const geofence = this.geofences.find(g => g && g.name === name)
        if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
          this.error++
          this.lastError += `Invalid latitude or longitude -> Name:${name}  latitude:${lat} longitude:${lon}\n`
        } else if (!geofence) {
          this.lastError += `Inserting -> Name:${name}  area:${area}\n`
          await this.$store.dispatch('addGeofence', { name, area })
          this.log = 'inserted ' + name
          this.inserted++
        } else {
          if (geofence.area && geofence.area.split(',')[0] !== area.split(',')[0]) {
            console.log(name, area, geofence.area)
            await this.$store.dispatch('updateGeofence', { ...geofence, area })
            this.log = `updated ${geofence.name}`
            this.updated++
            this.lastError += `updated ${geofence.name}\n`
          } else {
            this.lastError += `ignored ${geofence.name}\n`
            this.log = `ignored ${geofence.name}`
            this.ignored++
          }
        }
      } catch (e) {
        console.error(e)
        this.error++
        this.lastError += `${name} -> ${(e.response && e.response.data) || e.message}`
      }
    }
  },
  async mounted () {
    try {
      await this.$store.dispatch('getUserData')
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }
}
</script>
<style>
html {
 font-size: 100%;
}
* {
 font-size: 105%;
}

#loader {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: 120px;
  height: 120px;
  margin: -76px 0 0 -76px;
  border: 16px solid #f3f3f3;
  border-radius: 50%;
  border-top: 16px solid #3498db;
  -webkit-animation: spin 2s linear infinite;
  animation: spin 2s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

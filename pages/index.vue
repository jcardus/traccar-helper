<template>
  <div>
    user: {{this.session && this.session.email}} {{this.session && this.session.id}}
    <br/>
    <p>
      userid: <input type="text" v-model="userId">
      <button @click="devicesByUser">Filter</button>
    </p>
    {{geofences.length}} geofences:
    <button @click="showGeofences=!showGeofences">{{showGeofences?'Hide':'Show'}}</button>
    <button @click="selectedGeofences = geofences.map(g => g.id)">Select all</button>
    <ol v-if="showGeofences">
      <li v-for="d of geofences" :key="d.id" @click="toggleSelectedGeofence(d.id)"
          :style="selectedGeofences.includes(d.id)?'background-color: yellow':''">{{d.name}} {{d.attributes}}</li>
    </ol>
    <input @click="removeGeofences" :value="`Delete selected (${selectedGeofences.length})`" type="button">
    <p></p>
    <input @click="removeDuplicated" value="Delete duplicated" type="button">
    <p></p>
    Add Geofence from GeoJSON:
    <input ref="file" type="file" @change="addGeofence">
    <p></p>
    Add Geofences from CSV:
    <input ref="csv" type="file" @change="addGeofencesFromCSV">
    <p></p>
    {{groups.length}} groups:
    <button @click="showGroups=!showGroups">{{showGroups?'Hide':'Show'}}</button>
    <ol v-if="showGroups">
      <li v-for="d of groups" :key="d.id"
          :style="selectedGroups.includes(d.id)?'background-color: yellow':''">group {{d}}</li>
    </ol>
    <p></p>
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
    <textarea v-model="expression"></textarea>
    <input type="text" v-model="deviceId">
    <input type="button" value="Test Computed" @click="testComputed">
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
    <textarea readonly v-model="lastError" style="width: 50%; height: 100px"/>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { stringify } from 'wellknown'

export default {
  name: 'IndexPage',
  data () {
    return {
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
    ...mapGetters(['session', 'devices', 'geofences', 'groups'])
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
    devicesByUser () {
      this.$store.dispatch('getDevices', this.userId)
    },
    getComputed () {
      this.$store.dispatch('getComputed')
    },
    addDevice () {
      this.$store.dispatch('addDevice', prompt('Device name?'))
    },
    async removeGeofences () {
      for (const g of this.selectedGeofences) {
        await this.$store.dispatch('removeGeofence', g)
      }
    },
    async removeDuplicated () {
      const toRemove = []
      this.geofences.forEach((g, i, a) => {
        if (g !== a.find(e => e.name === g.name)) {
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
        const content = JSON.parse(res.target.result)
        for (const feature of content.features) {
          let area
          if (feature.geometry.type === 'Point') {
            area = `CIRCLE (${feature.geometry.coordinates[1].toFixed(6)} ${feature.geometry.coordinates[0].toFixed(6)}, 100)`
          } else {
            feature.geometry.coordinates = feature.geometry.coordinates.map(c => [c[1].toFixed(6), c[0].toFixed(6)])
            area = stringify(feature)
          }
          console.log(area)
          await this.$store.dispatch('addGeofence', { name, area })
        }
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },
    addGeofencesFromCSV () {
      this.file = this.$refs.csv.files[0]
      const reader = new FileReader()
      reader.onload = async (res) => {
        const content = res.target.result
        const lines = content.split('\n')
        this.max = lines.length
        for (const line of lines) {
          this.progress++
          const fields = line.split(';')
          const area = `CIRCLE (${fields[2]} ${fields[3]}, 100)`
          const name = fields[0] + ' - ' + fields[1]
          try {
            const geofence = this.geofences.find(g => g.name === name)
            if (!geofence) {
              await this.$store.dispatch('addGeofence', { name, area })
              this.log = 'inserted'
              this.inserted++
            } else {
              if (area !== geofence.area) {
                await this.$store.dispatch('updateGeofence', geofence)
                this.log = `updated ${geofence.name}`
                this.updated++
              } else {
                this.log = `ignored ${geofence.name}`
                this.ignored++
              }
            }
          } catch (e) {
            console.error(e)
            this.error++
            this.lastError += `${line} -> ${(e.response && e.response.data) || e.message}`
          }
        }
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    }
  },
  async mounted () {
    await this.$store.dispatch('getUserData')
  }
}
</script>

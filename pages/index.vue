<template>
  <div>
    <div class="loader" v-if="loading"></div>
    <div v-else>
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
      Add Geofence:
      <input ref="file" type="file" @change="addGeofence">
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
      <p><input type="datetime-local" v-model="from"></p>
      <p><input type="datetime-local" v-model="to"></p>
      <ol v-if="showDevices">
        <li v-for="d of devices" :key="d.id">{{d.name}}
          <p v-if="d.computed">COMPUTED: {{d.computed && d.computed.map(c => c.description).join(',')}}</p>
          <button @click="route(d)">Route</button>
        </li>
      </ol>
      <input type="button" value="Add Device" @click="addDevice">
      <p></p>
      <textarea v-model="expression"></textarea>
      <input type="text" v-model="deviceId">
      <input type="button" value="Test Computed" @click="testComputed">
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { stringify } from 'wellknown'
import { lineString } from '@turf/helpers'
// import route from '@/pages/route.json'

export default {
  name: 'IndexPage',
  data () {
    return {
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      loading: false,
      deviceId: 0,
      userId: 0,
      expression: '',
      file: null,
      showDevices: false,
      showGroups: false,
      showGeofences: false,
      selectedGeofences: [],
      selectedGroups: []
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
        console.log('json', content)
        for (const feature of content.features) {
          let area
          console.log('feature', feature)
          if (feature.geometry.type === 'Point') {
            area = `CIRCLE (${feature.geometry.coordinates[1].toFixed(6)} ${feature.geometry.coordinates[0].toFixed(6)}, 100)`
          } else {
            feature.geometry.coordinates = feature.geometry.coordinates.map(c => [c[1].toFixed(6), c[0].toFixed(6)])
            const geojson = stringify(feature)
            console.log('geojson', geojson)
            area = stringify(feature)
          }
          console.log(area)
          await this.$store.dispatch('addGeofence', { name, area })
        }
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },
    async route (device) {
      this.loading = true
      // const route = require('./route.json')
      const result = []
      const from = new Date(this.from).toISOString()
      const to = new Date(this.to).toISOString()
      const { route } = await this.$axios.$get(`/reports/allinone?deviceId=${device.id}&from=${from}&to=${to}&type=route&type=trips`)
      const chunk = 1000
      for (let i = 0; i < route.length; i += chunk) {
        const apiKey = process.env.geoapifyKey
        const slice = route.slice(i, i + chunk)
        window.open('http://geojson.io/#data=data:application/json,' +
          encodeURIComponent(JSON.stringify(lineString(slice.map(p => [p.longitude, p.latitude])))))
        const { features } = await this.$axios.$post(`https://api.geoapify.com/v1/mapmatching?apiKey=${apiKey}`, {
          mode: 'drive',
          waypoints: slice.map(p => ({
            timestamp: p.fixTime,
            bearing: p.bearing,
            location: [p.longitude, p.latitude]
          }))
        })

        const { properties } = features[0]
        window.open('http://geojson.io/#data=data:application/json,' +
          encodeURIComponent(JSON.stringify(features[0])))
        for (const wp of properties.waypoints) {
          const leg = properties.legs[wp.leg_index]
          if (!leg) {
            console.log('ignoring legs (count):', properties.legs.count, wp.leg_index)
            continue
          }
          const step = leg.steps[wp.step_index]
          const position = route[wp.original_index + i]
          if (!step) {
            console.log('ignoring', wp.step_index, wp.leg_index, properties.legs[0].steps[wp.step_index], properties.legs[0].steps.length)
            continue
          }
          if (wp.match_type !== 'unmatched' && step.speed_limit < position.speed * 1.852) {
            result.push({ ...wp, ...step, ...position })
          }
        }
      }
      console.log('result', result.filter(r => r.speed_limit > 40))
      this.loading = false
    }
  },
  async mounted () {
    await this.$store.dispatch('getUserData')
  }
}
</script>

<style>
.loader {
  border: 16px solid #f3f3f3; /* Light grey */
  border-top: 16px solid #3498db; /* Blue */
  border-radius: 50%;
  width: 120px;
  height: 120px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

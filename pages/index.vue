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
    <ol v-if="showGeofences">
      <li v-for="d of geofences" :key="d.id" @click="toggleSelectedGeofence(d.id)"
          :style="selectedGeofences.includes(d.id)?'background-color: yellow':''">{{d.name}} {{d.attributes}}</li>
    </ol>
    <input @click="removeGeofences" :value="`Delete selected (${selectedGeofences.length})`" type="button">
    <p></p>
    Add Geofence:
    <input ref="file" type="file" @change="addGeofence">
    <p></p>
    {{geofences.length}} groups:
    <ol>
      <li v-for="d of groups" :key="d.id">group {{d}}</li>
    </ol>
    {{devices.length}} devices:
    <button @click="showDevices=!showDevices">{{showDevices?'Hide':'Show'}}</button>
    <button @click="getComputed">Get Computed</button>
    <ol v-if="showDevices">
      <li v-for="d of devices" :key="d.id">{{d}}
        <p>COMPUTED: {{d.computed && d.computed.map(c => c.description).join(',')}}</p>
      </li>
    </ol>
    <input type="button" value="Add Device" @click="addDevice">
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { stringify } from 'wellknown'

export default {
  name: 'IndexPage',
  data () {
    return {
      userId: 0,
      file: null,
      showDevices: false,
      showGeofences: false,
      selectedGeofences: []
    }
  },
  computed: {
    ...mapGetters(['session', 'devices', 'geofences', 'groups'])
  },
  methods: {
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
    }
  },
  async mounted () {
    await this.$store.dispatch('getUserData')
  }
}
</script>

export const state = {
  session: null,
  devices: [],
  geofences: [],
  groups: [],
  loading: true
}

export const getters = {
  session: (state) => state.session,
  geofences: (state) => state.geofences,
  groups: (state) => state.groups,
  devices: (state) => state.devices,
  loading: (state) => state.loading
}

const pendingInserts = []
const chunkSize = 1000

export const actions = {
  async removeGeofences ({ commit }, geofenceIds) {
    return this.$axios.$post('../pinmeapi/geofences/bulk/delete', geofenceIds)
  },
  async addDevice ({ commit }, name) {
    await this.$axios.$post('devices', { name, uniqueId: name })
    commit('SET_DEVICES', await this.$axios.$get('devices'))
  },
  async addGeofence ({ commit, dispatch }, { name, area }) {
    pendingInserts.push({ name, area })
    if (pendingInserts.length === chunkSize) {
      await dispatch('bulkInsert')
    }
  },
  async bulkInsert () {
    await this.$axios.$post('../pinmeapi/geofences/bulk', pendingInserts)
    pendingInserts.length = 0
  },
  async updateGeofence ({ commit }, geofence) {
    await this.$axios.$put('geofences/' + geofence.id, geofence)
  },
  async getDevices ({ commit }, userId) {
    commit('SET_DEVICES', await this.$axios.$get('devices' + (userId ? `?userId=${userId}` : '')))
  },
  async getUserData ({ commit, dispatch }) {
    commit('SET_LOADING', true)
    await dispatch('getDevices')
    commit('SET_SESSION', await this.$axios.$get('session'))
    commit('SET_GEOFENCES', await this.$axios.$get('geofences'))
    commit('SET_GROUPS', await this.$axios.$get('groups'))
    commit('SET_LOADING', false)
  },
  async getComputed ({ commit, state }) {
    for (const d of state.devices) {
      d.computed = await this.$axios.$get('/attributes/computed?deviceId=' + d.id)
      commit('SET_DEVICE', d)
    }
  }
}
export const mutations = {
  SET_DEVICE (state, device) {
    state.devices.splice(state.devices.indexOf(device), 1, device)
  },
  SET_SESSION (state, session) {
    state.session = session
  },
  SET_DEVICES (state, devices) {
    state.devices = devices
  },
  SET_GROUPS (state, groups) {
    state.groups = groups
  },
  SET_GEOFENCES (state, geofences) {
    console.log(geofences)
    if (geofences && geofences.length) {
      state.geofences = geofences.sort((a, b) => a.name.localeCompare(b.name))
    }
  },
  SET_LOADING (state, loading) {
    state.loading = loading
  }
}

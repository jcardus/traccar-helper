export const state = {
  session: null,
  devices: [],
  geofences: [],
  groups: []
}

export const getters = {
  session: (state) => state.session,
  geofences: (state) => state.geofences,
  groups: (state) => state.groups,
  devices: (state) => state.devices
}

export const actions = {
  async addDevice ({ commit }, name) {
    await this.$axios.$post('devices', { name, uniqueId: name })
    commit('SET_DEVICES', await this.$axios.$get('devices'))
  },
  async addGeofence ({ commit }, { name, area }) {
    await this.$axios.$post('geofences', { name, area })
    commit('SET_GEOFENCES', await this.$axios.$get('geofences'))
  },
  async removeGeofence ({ commit }, geofenceId) {
    await this.$axios.$delete('geofences/' + geofenceId)
  },
  async getDevices ({ commit }, userId) {
    commit('SET_DEVICES', await this.$axios.$get('devices' + (userId ? `?userId=${userId}` : '')))
  },
  async getUserData ({ commit, dispatch }) {
    await dispatch('getDevices')
    commit('SET_SESSION', await this.$axios.$get('session'))
    commit('SET_GEOFENCES', await this.$axios.$get('geofences'))
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
  SET_GEOFENCES (state, geofences) {
    state.geofences = geofences.sort((a, b) => a.name.localeCompare(b.name))
  }
}

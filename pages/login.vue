<template>
  <div>
    <input type="text" v-model="email" size="40">
    <input type="password" v-model="password" size="40">
    <input type="button" value="GO" @click="login">
  </div>
</template>

<script>
export default {
  name: 'loginPage',
  data () {
    return {
      email: '',
      password: ''
    }
  },
  methods: {
    login () {
      this.$axios.$post('session', `email=${this.email}&password=${this.password}`)
    }
  }
}
</script>

<style scoped>

</style>

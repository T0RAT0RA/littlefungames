import Vue from 'vue';
// import Vuetify from 'vuetify';
import VueI18n from 'vue-i18n';
import App from './App.vue';
import router from './router';

// import 'vuetify/dist/vuetify.min.css';

// Vue.use(Vuetify);
Vue.use(VueI18n);

const i18n = new VueI18n({
  locale: 'fr',
});

new Vue({
  el: '#app',
  router,
  i18n,
  render: h => h(App)
});

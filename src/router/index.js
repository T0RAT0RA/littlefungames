import Vue from 'vue';
import Router from 'vue-router';
import Index from '@/Index';
import Screen from '@/Screen';
import Remote from '@/Remote';

Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'index',
      component: Index
    },
    {
      path: '/play/:room?',
      name: 'play',
      component: Screen,
      props: true
    },
    {
      path: '/r/:room?',
      name: 'remote',
      component: Remote,
      props: true
    }
  ]
})
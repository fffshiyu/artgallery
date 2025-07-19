import Vue from 'vue';
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import App from './App.vue';
import router from './router';
import store from './store';
import './assets/reset.css';
import bus from './bus';
import dataV from '@jiaminghi/data-view';
import echarts from 'echarts';
import './assets/animate.css';
import './assets/style.css';
import countTo from 'vue-count-to';
Vue.component('count-to', countTo);
Vue.use(ElementUI);

Vue.config.productionTip = false;
Vue.prototype.$EventBus = bus;

Vue.prototype.$echarts = echarts;

Vue.use(dataV);

new Vue({
  router,
  store,
  render: (h) => h(App)
}).$mount('#app');

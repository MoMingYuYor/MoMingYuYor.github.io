import { createApp } from 'vue'
import App from './App.vue'
/* 展示用衬线字体：Noto Serif SC 本地子集（OFL 授权，由 scripts/prepare-fonts.py 按站点字符清单生成） */
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/global.css'

createApp(App).mount('#app')

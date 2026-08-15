import { createRouter, createWebHistory } from "vue-router";

import AdminVideoEditView from "./views/AdminVideoEditView.vue";
import AdminVideosView from "./views/AdminVideosView.vue";
import HomeView from "./views/HomeView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/admin/videos",
      name: "admin-videos",
      component: AdminVideosView,
    },
    {
      path: "/admin/videos/:id(.*)",
      name: "admin-video-edit",
      component: AdminVideoEditView,
      props: true,
    },
  ],
});

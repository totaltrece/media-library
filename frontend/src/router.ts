import { createRouter, createWebHistory } from "vue-router";

import AdminTagsView from "./views/AdminTagsView.vue";
import AdminVideoEditView from "./views/AdminVideoEditView.vue";
import AdminVideoUploadView from "./views/AdminVideoUploadView.vue";
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
      path: "/admin/videos/upload",
      name: "admin-video-upload",
      component: AdminVideoUploadView,
    },
    {
      path: "/admin/tags",
      name: "admin-tags",
      component: AdminTagsView,
    },
    {
      path: "/admin/videos/:id(.*)",
      name: "admin-video-edit",
      component: AdminVideoEditView,
      props: true,
    },
  ],
});

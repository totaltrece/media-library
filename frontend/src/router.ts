import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import AdminTagsView from "./views/AdminTagsView.vue";
import AdminVideoEditView from "./views/AdminVideoEditView.vue";
import AdminVideoUploadView from "./views/AdminVideoUploadView.vue";
import AdminVideosView from "./views/AdminVideosView.vue";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
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
    path: "/admin/videos",
    redirect: (to) => ({ path: "/", query: to.query, hash: to.hash }),
  },
  {
    path: "/admin/videos/:id(.*)",
    name: "admin-video-edit",
    component: AdminVideoEditView,
    props: true,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

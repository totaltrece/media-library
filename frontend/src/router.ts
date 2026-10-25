import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import { loadAuthSession, useAuth } from "./auth/session.js";
import AdminTagsView from "./views/AdminTagsView.vue";
import AdminTagTypesView from "./views/AdminTagTypesView.vue";
import AdminVideoEditView from "./views/AdminVideoEditView.vue";
import AdminVideoUploadView from "./views/AdminVideoUploadView.vue";
import AdminVideosView from "./views/AdminVideosView.vue";
import AdminZoneView from "./views/AdminZoneView.vue";

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
    path: "/admin/tag-types",
    name: "admin-tag-types",
    component: AdminTagTypesView,
  },
  {
    path: "/admin",
    name: "admin-zone",
    component: AdminZoneView,
    meta: { requiresAdmin: true },
  },
  {
    path: "/admin/users",
    redirect: "/admin",
  },
  {
    path: "/admin/backup",
    redirect: "/admin",
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

router.beforeEach(async (to) => {
  if (to.meta.requiresAdmin !== true) {
    return true;
  }

  await loadAuthSession();
  const { canWrite } = useAuth();

  if (!canWrite.value) {
    return { name: "home" };
  }

  return true;
});

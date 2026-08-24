import { beforeEach, describe, expect, it } from "vitest";
import { useNovedadesStore, novedadesStoreApi } from "./use-novedades-store";

describe("useNovedadesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    novedadesStoreApi.setState({
      isOpen: false,
      readIds: []
    });
  });

  it("calculates unread items count properly", () => {
    const { releases, getUnreadCount } = novedadesStoreApi.getState();
    expect(getUnreadCount()).toBe(releases.length);
  });

  it("marks single release as read", () => {
    const { releases, markAsRead, isRead, getUnreadCount } = novedadesStoreApi.getState();
    const firstId = releases[0].id;

    expect(isRead(firstId)).toBe(false);

    markAsRead(firstId);

    expect(novedadesStoreApi.getState().isRead(firstId)).toBe(true);
    expect(novedadesStoreApi.getState().getUnreadCount()).toBe(releases.length - 1);
  });

  it("marks all releases as read", () => {
    const { releases, markAllAsRead, getUnreadCount } = novedadesStoreApi.getState();
    expect(getUnreadCount()).toBe(releases.length);

    markAllAsRead();

    expect(novedadesStoreApi.getState().getUnreadCount()).toBe(0);
    releases.forEach((r) => {
      expect(novedadesStoreApi.getState().isRead(r.id)).toBe(true);
    });
  });

  it("controls drawer open and close states", () => {
    const { openDrawer, closeDrawer } = novedadesStoreApi.getState();

    expect(novedadesStoreApi.getState().isOpen).toBe(false);

    openDrawer();
    expect(novedadesStoreApi.getState().isOpen).toBe(true);

    closeDrawer();
    expect(novedadesStoreApi.getState().isOpen).toBe(false);
  });
});

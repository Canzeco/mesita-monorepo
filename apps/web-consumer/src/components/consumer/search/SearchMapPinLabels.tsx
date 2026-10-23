"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import {
  MAP_PIN_NAME_MIN_ZOOM,
  estimateLabelRect,
  pickVisiblePinLabels,
} from "./map-pin-labels";

export type PinLabelItem = {
  id: string;
  lat: number;
  lng: number;
  title: string;
};

type PinLabelOverlay = {
  onAdd: () => void;
  draw: () => void;
  onRemove: () => void;
  setMap: (map: object | null) => void;
  getPanes: () => { floatPane: HTMLElement } | null;
  getMap: () => { getZoom: () => number | undefined } | null;
  getProjection: () => {
    fromLatLngToDivPixel: (
      latLng: { lat: () => number; lng: () => number },
    ) => { x: number; y: number } | null;
  } | null;
};

type MapsNamespace = {
  maps: {
    OverlayView: new () => PinLabelOverlay;
    LatLng: new (lat: number, lng: number) => { lat: () => number; lng: () => number };
    event: { trigger: (instance: object, eventName: string) => void };
  };
};

function mapsNamespace(): MapsNamespace["maps"] | null {
  const g = (globalThis as { google?: MapsNamespace }).google;
  return g?.maps ?? null;
}

/** Floating pin names from zoom 14; the focused pin always wins collisions (d4a). */
export function SearchMapPinLabels({
  items,
  focusedId,
}: {
  items: PinLabelItem[];
  focusedId: string | null;
}) {
  const map = useMap();
  const dataRef = useRef({ items, focusedId });
  dataRef.current = { items, focusedId };

  useEffect(() => {
    const maps = mapsNamespace();
    if (!map || !maps) return;

    let div: HTMLDivElement | null = null;
    const overlay = new maps.OverlayView();

    overlay.onAdd = () => {
      div = document.createElement("div");
      div.className =
        "pointer-events-none absolute inset-0 overflow-visible [&_*]:pointer-events-none";
      overlay.getPanes()?.floatPane.appendChild(div);
    };

    overlay.draw = () => {
      if (!div) return;
      const zoom = overlay.getMap()?.getZoom() ?? 0;
      if (zoom < MAP_PIN_NAME_MIN_ZOOM) {
        div.replaceChildren();
        return;
      }
      const projection = overlay.getProjection();
      if (!projection) return;

      const { items: pinItems, focusedId: focus } = dataRef.current;
      const candidates = pinItems
        .map((item) => {
          const point = projection.fromLatLngToDivPixel(
            new maps.LatLng(item.lat, item.lng),
          );
          if (!point) return null;
          return {
            id: item.id,
            title: item.title,
            x: point.x,
            y: point.y,
            focused: item.id === focus,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c != null);

      const visible = pickVisiblePinLabels(candidates);
      const frag = document.createDocumentFragment();
      for (const c of candidates) {
        if (!visible.has(c.id)) continue;
        const rect = estimateLabelRect(c.x, c.y, c.title);
        const el = document.createElement("div");
        el.textContent = c.title;
        el.className =
          "absolute max-w-[10.5rem] truncate rounded-md bg-card/95 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm";
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.right - rect.left}px`;
        if (c.focused) el.style.zIndex = "2";
        frag.appendChild(el);
      }
      div.replaceChildren(frag);
    };

    overlay.onRemove = () => {
      div?.remove();
      div = null;
    };

    overlay.setMap(map);
    const redraw = () => overlay.draw();
    const zoom = map.addListener("zoom_changed", redraw);
    const idle = map.addListener("idle", redraw);
    redraw();
    return () => {
      zoom.remove();
      idle.remove();
      overlay.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    const maps = mapsNamespace();
    if (!map || !maps) return;
    maps.event.trigger(map, "idle");
  }, [map, items, focusedId]);

  return null;
}

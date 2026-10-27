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
    fromLatLngToDivPixel: (latLng: {
      lat: () => number;
      lng: () => number;
    }) => { x: number; y: number } | null;
  } | null;
};

type MapsNamespace = {
  maps: {
    OverlayView: new () => PinLabelOverlay;
    LatLng: new (
      lat: number,
      lng: number,
    ) => { lat: () => number; lng: () => number };
    event: { trigger: (instance: object, eventName: string) => void };
  };
};

function mapsNamespace(): MapsNamespace["maps"] | null {
  const g = (globalThis as { google?: MapsNamespace }).google;
  return g?.maps ?? null;
}

/** Floating pin names from zoom 14; haloed map type, never a chip (MESITA-2748). The focused pin always wins collisions (d4a). */
export function SearchMapPinLabels({
  items,
  focusedId,
}: {
  items: PinLabelItem[];
  focusedId: string | null;
}) {
  const map = useMap();
  const dataRef = useRef({ items, focusedId });

  useEffect(() => {
    dataRef.current = { items, focusedId };
  }, [items, focusedId]);

  useEffect(() => {
    const maps = mapsNamespace();
    if (!map || !maps) return;

    let div: HTMLDivElement | null = null;
    const overlay = new maps.OverlayView();

    overlay.onAdd = () => {
      div = document.createElement("div");
      div.className =
        "pointer-events-none absolute inset-0 overflow-visible [&_*]:pointer-events-none";
      div.setAttribute("aria-hidden", "true");
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
        // Cartographic caption (MESITA-2748): ink + white halo, never a chip.
        el.className = "type-label absolute max-w-[10.5rem] truncate";
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.right - rect.left}px`;
        el.style.color = c.focused ? "#1a1a1a" : "#3f3f3f";
        el.style.fontWeight = c.focused ? "600" : "500";
        el.style.paintOrder = "stroke fill";
        el.style.webkitTextStroke = "2px #ffffff";
        el.style.textShadow =
          "-1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, 0 0 2px #fff";
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

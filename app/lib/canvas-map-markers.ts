import L from 'leaflet';
import { geometry, resolveMapMarkerLabelStyle } from './map-marker-style';

export type CanvasMapMarker = {
  latitude: number; longitude: number; color: string; label: string | null;
  size: number; anchorX: number; anchorY: number; zIndex: number;
};

/** One composited visual layer; individual Leaflet markers retain input/a11y. */
export class CanvasMapMarkers {
  private records = new Map<symbol, CanvasMapMarker>();
  private sprites = new Map<string, HTMLCanvasElement>();
  private canvas: HTMLCanvasElement | null = null;
  private overlay: L.ImageOverlay | null = null;
  private frame: number | null = null;
  private bounds: L.LatLngBounds | null = null;
  private width = 0;
  private height = 0;
  private draws = 0;
  private ratio = 1;
  private zooming = false;

  constructor(private map: L.Map) {}

  attach() {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext?.('2d') || typeof Path2D === 'undefined') return false;
    this.canvas = canvas;
    canvas.className = 'hwb-marker-canvas';
    canvas.style.pointerEvents = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    this.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.map.on('resize', this.schedule);
    this.map.on('zoomstart', this.onZoomStart);
    this.map.on('zoomend', this.onZoomEnd);
    this.map.on('move', this.checkBuffer);
    this.draw();
    return true;
  }

  detach() {
    this.map.off('resize', this.schedule);
    this.map.off('zoomstart', this.onZoomStart);
    this.map.off('zoomend', this.onZoomEnd);
    this.map.off('move', this.checkBuffer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.overlay?.remove();
    this.overlay = null;
    this.canvas = null;
    this.bounds = null;
    this.sprites.clear();
  }

  set(key: symbol, record: CanvasMapMarker) { this.records.set(key, record); this.schedule(); }
  delete(key: symbol) { this.records.delete(key); this.schedule(); }

  private onZoomStart = () => { this.zooming = true; };
  private onZoomEnd = () => { this.zooming = false; this.schedule(); };

  private schedule = () => {
    if (!this.canvas || this.frame !== null || this.zooming) return;
    this.frame = requestAnimationFrame(() => { this.frame = null; this.draw(); });
  };

  private checkBuffer = () => {
    if (!this.bounds || this.zooming) return;
    const point = this.map.latLngToContainerPoint(this.bounds.getNorthWest());
    const size = this.map.getSize();
    // Long flings may cross the prepainted margin. Refill at that boundary,
    // rather than painting every marker on every touchmove.
    const north = this.bounds.getNorth() < 85.05 && point.y > -64;
    const south = this.bounds.getSouth() > -85.05 && point.y + this.height < size.y + 64;
    if (point.x > -64 || north || point.x + this.width < size.x + 64 || south) this.schedule();
  };

  private sprite(record: CanvasMapMarker) {
    const key = `${record.color}:${record.label}:${record.size}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const width = record.size;
    const height = record.size <= 18 ? record.size : Math.round(record.size * 52 / 48);
    const image = document.createElement('canvas');
    image.width = Math.ceil((width + 16) * this.ratio);
    image.height = Math.ceil((height + 16) * this.ratio);
    const context = image.getContext('2d')!;
    context.scale(this.ratio, this.ratio);
    context.translate(8, 8);
    if (record.size <= 18) {
      context.beginPath(); context.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
      context.fillStyle = record.color; context.fill();
      context.strokeStyle = '#fff'; context.lineWidth = 2; context.stroke();
    } else {
      context.scale(width / geometry.width, height / geometry.height);
      const path = new Path2D(geometry.pinPath);
      // Bake the shadow once per visual, not as 222 live CSS filters.
      context.shadowColor = 'rgba(20,30,20,0.24)'; context.shadowBlur = 2.2;
      context.shadowOffsetY = 4;
      context.fillStyle = '#fff'; context.fill(path, 'evenodd');
      context.shadowColor = 'transparent';
      context.strokeStyle = '#fff'; context.lineWidth = 2; context.stroke(path);
      context.fillStyle = record.color; context.fill(path, 'evenodd');
      const label = record.label ?? '';
      const badge = resolveMapMarkerLabelStyle(label || '--');
      context.beginPath(); context.arc(geometry.width / 2, geometry.badgeY, badge.badgeRadius, 0, Math.PI * 2);
      context.fillStyle = '#fff'; context.fill();
      context.font = `700 ${badge.fontSize}px Arial, Helvetica, sans-serif`;
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillStyle = '#111'; context.fillText(label, geometry.width / 2, geometry.labelY);
    }
    this.sprites.set(key, image);
    return image;
  }

  private draw() {
    if (!this.canvas) return;
    const size = this.map.getSize();
    const padding = Math.min(512, Math.max(256, size.x));
    this.width = size.x + padding * 2;
    this.height = size.y + padding * 2;
    this.bounds = L.latLngBounds(
      this.map.containerPointToLatLng(L.point(-padding, -padding)),
      this.map.containerPointToLatLng(L.point(size.x + padding, size.y + padding))
    );
    const origin = this.map.latLngToLayerPoint(this.bounds.getNorthWest());
    const end = this.map.latLngToLayerPoint(this.bounds.getSouthEast());
    // At world zoom the buffer may exceed Web Mercator's latitude limits.
    // Match the projected overlay size instead of stretching the marker bitmap.
    this.width = Math.max(1, end.x - origin.x);
    this.height = Math.max(1, end.y - origin.y);
    this.canvas.width = Math.ceil(this.width * this.ratio);
    this.canvas.height = Math.ceil(this.height * this.ratio);
    const context = this.canvas.getContext('2d')!;
    context.scale(this.ratio, this.ratio);
    const projected = Array.from(this.records.values(), record => ({ record, point: this.map.latLngToLayerPoint([record.latitude, record.longitude]) }));
    projected.sort((a, b) => (a.point.y + a.record.zIndex) - (b.point.y + b.record.zIndex));
    for (const { record, point } of projected) {
      const height = record.size <= 18 ? record.size : Math.round(record.size * 52 / 48);
      const image = this.sprite(record);
      // Every record is drawn; the canvas clips naturally outside its buffer.
      context.drawImage(image, point.x - origin.x - record.size * record.anchorX - 8,
        point.y - origin.y - height * record.anchorY - 8, image.width / this.ratio, image.height / this.ratio);
    }
    if (!this.overlay) {
      // Reuse Leaflet's geographic positioning and zoom animation, replacing
      // only its image creation with our existing canvas (no bitmap readback).
      const canvas = this.canvas;
      class Overlay extends L.ImageOverlay {
        declare _image: HTMLCanvasElement;
        _initImage() {
          this._image = canvas;
          canvas.classList.add('leaflet-image-layer', 'leaflet-zoom-animated', 'hwb-marker-canvas');
          canvas.style.zIndex = '0';
        }
      }
      this.overlay = new Overlay('', this.bounds, {
        pane: 'markerPane', interactive: false, zIndex: 0, className: 'hwb-marker-canvas',
      }).addTo(this.map);
    } else this.overlay.setBounds(this.bounds);
    this.canvas.dataset.recordCount = String(this.records.size);
    this.canvas.dataset.drawCount = String(++this.draws);
    this.canvas.dataset.spriteCount = String(this.sprites.size);
  }
}

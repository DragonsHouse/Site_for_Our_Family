import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import { QUANTFUN_MAP_URL } from '../../../lib/constants';
import {
  deleteMapZone,
  deleteMapUserPoint,
  getMapUserPoints,
  getMapZones,
  saveMapUserPoint,
  saveMapZone
} from '../../../lib/db';
import type { MapUserPoint, MapZone } from '../../../lib/types';

function catmullRomPath(points: Array<{ x: number; y: number }>, scale: number): string {
  if (points.length < 2) return '';
  const pts = points.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const closed = true;
  const res: Array<{ x: number; y: number }> = [];
  const total = pts.length;
  const get = (i: number) => pts[(i + total) % total];
  for (let i = 0; i < total; i += 1) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6
    };
    res.push(p1, cp1, cp2, p2);
  }
  const [start] = pts;
  let d = `M ${start.x} ${start.y}`;
  for (let i = 0; i < res.length; i += 4) {
    const [, cp1, cp2, p2] = res.slice(i, i + 4);
    if (!p2) continue;
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
  }
  if (closed) d += ' Z';
  return d;
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getPolygonBoundsCenter(points: Array<{ x: number; y: number }>) {
  if (!points.length) return { x: 0, y: 0 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2)
  };
}

function shortIconLabel(iconUrl: string | null | undefined): string {
  if (!iconUrl) return 'icon';
  const normalized = String(iconUrl).replace(/\\/g, '/');
  const fromPath = normalized.split('/').pop() || normalized;
  return fromPath.split('?')[0] || fromPath;
}

type DefaultMapMarker = {
  id: string;
  x: number;
  y: number;
  title: string;
  layerName: string;
  iconUrl: string | null;
};

const MAP_MAX_ZOOM = 7;
const MAP_MIN_ZOOM = 1;
const MAP_WIDTH = 16128;
const MAP_HEIGHT = 24320;
const TILE_SIZE = 256;
const MAP_ZOOM_STEP = 0.1;

function normalizeMapZoom(value: number): number {
  return Math.round(value * 10) / 10;
}

function baseLayerLabel(layerName: string): string {
  return layerName.replace(/\s*\(.+?\)$/, '').trim();
}

function isLayerEnabledByDefault(layerName: string): boolean {
  const base = baseLayerLabel(layerName).toLowerCase();
  const excluded = [
    'апарати з водою',
    'апарати з їжею',
    'вибухові пристрої',
    'графіті',
    'нло в океані',
    'нло у штаті',
    'сміттєві баки',
    'сміттєві пакети',
    'спавни автоугонок',
    'маркер координат'
  ];
  return !excluded.some((item) => base.includes(item));
}

export function MapPanel() {
  type ZoneDraftMeta = {
    id?: string;
    name: string;
    color: string;
    opacity: number;
    imageDataUrl: string | null;
    imageX: number | null;
    imageY: number | null;
    imageWidth: number | null;
    imageHeight: number | null;
    imageRotation: number;
    imageOpacity: number;
    cropTop: number;
    cropRight: number;
    cropBottom: number;
    cropLeft: number;
  };

  type ContextMenuState = {
    open: boolean;
    x: number;
    y: number;
    mapX: number;
    mapY: number;
    pointId: number | null;
    defaultMarkerId: string | null;
    zoneId: string | null;
  };

  type PointEditorState = {
    mode: 'create' | 'edit' | 'edit-default';
    id?: number;
    sourceMarkerId?: string | null;
    x: number;
    y: number;
    title: string;
    iconMode: 'preset' | 'custom';
    iconUrl: string | null;
    customIconDataUrl: string | null;
    detailImageDataUrl: string | null;
    zoneId: string | null;
    filterLabel: string;
    note: string;
    color: string;
  };

  const [zoom, setZoom] = useState(4.0);
  const [mapVariant, setMapVariant] = useState<'map' | 'mapg'>('map');
  const [addMode, setAddMode] = useState(false);
  const [defaultMarkers, setDefaultMarkers] = useState<DefaultMapMarker[]>([]);
  const [userPoints, setUserPoints] = useState<MapUserPoint[]>([]);
  const [zones, setZones] = useState<MapZone[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [zoneDraftMode, setZoneDraftMode] = useState<'none' | 'create' | 'edit'>('none');
  const [zoneDraftPoints, setZoneDraftPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [zonePointPickMode, setZonePointPickMode] = useState(false);
  const [pointEditorPickMode, setPointEditorPickMode] = useState(false);
  const [zoneDraftMeta, setZoneDraftMeta] = useState<ZoneDraftMeta>({
    name: '',
    color: '#22c55e',
    opacity: 0.2,
    imageDataUrl: null,
    imageX: null,
    imageY: null,
    imageWidth: null,
    imageHeight: null,
    imageRotation: 0,
    imageOpacity: 0.35,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    cropLeft: 0
  });
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    width: 1200,
    height: 720
  });
  const [showDefaultMarkers, setShowDefaultMarkers] = useState(true);
  const [showUserPoints, setShowUserPoints] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [layerFilterOpen, setLayerFilterOpen] = useState(false);
  const [layerSearch, setLayerSearch] = useState('');
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [userLabelFilter, setUserLabelFilter] = useState('all');
  const [expandedUserCategory, setExpandedUserCategory] = useState<string | null>(null);
  const [expandedLayerName, setExpandedLayerName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPageExpanded, setIsPageExpanded] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [customIconLibrary, setCustomIconLibrary] = useState<string[]>([]);
  const [allowDefaultMarkerEditing, setAllowDefaultMarkerEditing] = useState(false);
  const [allowDefaultMarkerAddButton, setAllowDefaultMarkerAddButton] = useState(true);
  const [allowDefaultMarkerEditButton, setAllowDefaultMarkerEditButton] = useState(true);
  const [allowDefaultMarkerDeleteButton, setAllowDefaultMarkerDeleteButton] = useState(true);
  const [allowPointAdd, setAllowPointAdd] = useState(true);
  const [allowZoneAdd, setAllowZoneAdd] = useState(true);
  const [allowZoneEdit, setAllowZoneEdit] = useState(true);
  const [movingDefaultMarkerId, setMovingDefaultMarkerId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    mapX: 0,
    mapY: 0,
    pointId: null,
    defaultMarkerId: null,
    zoneId: null
  });
  const [pointEditor, setPointEditor] = useState<PointEditorState | null>(null);
  const [pendingSystemMarkerVisibility, setPendingSystemMarkerVisibility] = useState<Record<string, boolean>>({});
  const [savingSystemMarkerVisibility, setSavingSystemMarkerVisibility] = useState<Record<string, boolean>>({});
  const [mapFocusPing, setMapFocusPing] = useState<{ x: number; y: number } | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapFocusPingTimeoutRef = useRef<number | null>(null);
  const panAnimationFrameRef = useRef<number | null>(null);
  const wheelZoomRafRef = useRef<number | null>(null);
  const wheelZoomDirectionRef = useRef(0);
  const wheelClientPointRef = useRef<{ x: number; y: number } | null>(null);
  const panTargetRef = useRef<{ left: number; top: number } | null>(null);
  const initialCenterDoneRef = useRef(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
  });
  const [draggingZonePointIndex, setDraggingZonePointIndex] = useState<number | null>(null);

  const clampedZoom = normalizeMapZoom(Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, zoom)));
  const sourceZoom = Math.floor(clampedZoom);
  const fractionalScale = 2 ** (clampedZoom - sourceZoom);
  const scale = 2 ** (clampedZoom - MAP_MAX_ZOOM);
  const sourceWorldWidth = Math.ceil(MAP_WIDTH * 2 ** (sourceZoom - MAP_MAX_ZOOM));
  const sourceWorldHeight = Math.ceil(MAP_HEIGHT * 2 ** (sourceZoom - MAP_MAX_ZOOM));
  const worldWidth = Math.ceil(sourceWorldWidth * fractionalScale);
  const worldHeight = Math.ceil(sourceWorldHeight * fractionalScale);
  const mapOffsetX = Math.max(0, Math.floor((viewport.width - worldWidth) / 2));
  const mapOffsetY = Math.max(0, Math.floor((viewport.height - worldHeight) / 2));
  const mapCanvasWidth = Math.max(worldWidth, viewport.width);
  const mapCanvasHeight = Math.max(worldHeight, viewport.height);
  const renderedTileSize = TILE_SIZE * fractionalScale;
  const zoneStrokeWidth = Math.max(2, Math.min(4, 2.5 * scale));
  const zoneSecondaryStrokeWidth = Math.max(1.5, Math.min(3, 2 * scale));
  const zonePointSize = Math.max(10, Math.min(18, 14 * scale));

  const layerNames = useMemo(
    () => Array.from(new Set(defaultMarkers.map((marker) => marker.layerName))).sort((a, b) => a.localeCompare(b)),
    [defaultMarkers]
  );

  const layerIconByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const marker of defaultMarkers) {
      if (!map.has(marker.layerName)) {
        map.set(marker.layerName, marker.iconUrl ?? null);
      }
    }
    return map;
  }, [defaultMarkers]);

  const availableIconUrls = useMemo(
    () =>
      Array.from(
        new Set(
          defaultMarkers
            .map((marker) => marker.iconUrl)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [defaultMarkers]
  );
  const allPresetIconUrls = useMemo(
    () => Array.from(new Set([...customIconLibrary, ...availableIconUrls])),
    [customIconLibrary, availableIconUrls]
  );

  const userFilterLabels = useMemo(
    () =>
      Array.from(
        new Set(
          userPoints
            .map((point) => point.filterLabel?.trim() ?? '')
            .filter((value) => value.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [userPoints]
  );

  const layerSet = useMemo(() => new Set(selectedLayers), [selectedLayers]);
  const zoneById = useMemo(() => {
    const map = new Map<string, MapZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);
  const markerOverrides = useMemo(() => {
    const map = new Map<string, MapUserPoint>();
    for (const point of userPoints) {
      if (point.sourceMarkerId) {
        map.set(point.sourceMarkerId, point);
      }
    }
    return map;
  }, [userPoints]);
  const systemMarkerHiddenById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const point of userPoints) {
      if (!point.sourceMarkerId) continue;
      if (point.hidden) {
        map.set(point.sourceMarkerId, true);
      } else if (!map.has(point.sourceMarkerId)) {
        map.set(point.sourceMarkerId, false);
      }
    }
    return map;
  }, [userPoints]);
  const customUserPoints = useMemo(
    () => userPoints.filter((point) => !point.sourceMarkerId),
    [userPoints]
  );
  const userCategoryEntries = useMemo(() => {
    const map = new Map<string, MapUserPoint[]>();
    for (const point of customUserPoints) {
      const label = (point.filterLabel ?? '').trim() || 'Без категорії';
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(point);
    }
    return Array.from(map.entries())
      .map(([label, points]) => ({
        label,
        points: points.sort((a, b) => a.title.localeCompare(b.title))
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [customUserPoints]);

  const visibleDefaultMarkers = useMemo(() => {
    return defaultMarkers.filter((marker) => {
      if (!layerSet.has(marker.layerName)) return false;
      if (systemMarkerHiddenById.get(marker.id) === true) return false;
      return true;
    });
  }, [defaultMarkers, layerSet, systemMarkerHiddenById]);

  const filteredCustomPoints = useMemo(() => {
    return customUserPoints.filter((point) => {
      const label = (point.filterLabel ?? '').trim();
      if (userLabelFilter === '__no_category' && label.length > 0) return false;
      if (userLabelFilter !== 'all' && userLabelFilter !== '__no_category' && label !== userLabelFilter) return false;
      return true;
    });
  }, [customUserPoints, userLabelFilter]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;

    const updateViewport = () => {
      setViewport({
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
        width: element.clientWidth,
        height: element.clientHeight
      });
    };

    updateViewport();
    element.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);
    return () => {
      element.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [pointsRes, markerRes, zonesRes] = await Promise.all([
          getMapUserPoints(),
          fetch(chrome.runtime.getURL('map/default-markers.json')),
          getMapZones()
        ]);

        if (!markerRes.ok) {
          throw new Error(`Не вдалося завантажити default-markers.json (${markerRes.status})`);
        }

        const markerData = (await markerRes.json()) as { markers?: DefaultMapMarker[] };
        const nextMarkers = Array.isArray(markerData.markers) ? markerData.markers : [];
        const nextLayerNames = Array.from(new Set(nextMarkers.map((marker) => marker.layerName))).sort((a, b) =>
          a.localeCompare(b)
        );
        setDefaultMarkers(nextMarkers);
        setSelectedLayers((prev) => {
          if (prev.length) {
            return prev.filter((name) => nextLayerNames.includes(name));
          }
          return nextLayerNames.filter((name) => isLayerEnabledByDefault(name));
        });
        setUserPoints(pointsRes);
        setZones(zonesRes);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Помилка завантаження офлайн карти');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!contextMenu.open) return;
    const close = () =>
      setContextMenu((prev) => ({ ...prev, open: false, pointId: null, defaultMarkerId: null, zoneId: null }));
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu.open]);

  useEffect(
    () => () => {
      if (panAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(panAnimationFrameRef.current);
        panAnimationFrameRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      const element = mapRef.current;
      setIsFullscreen(Boolean(element && document.fullscreenElement === element));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('quant_map_allow_default_marker_editing');
      setAllowDefaultMarkerEditing(raw === '1');
      setAllowDefaultMarkerAddButton(window.localStorage.getItem('quant_map_allow_default_marker_add_button') !== '0');
      setAllowDefaultMarkerEditButton(window.localStorage.getItem('quant_map_allow_default_marker_edit_button') !== '0');
      setAllowDefaultMarkerDeleteButton(window.localStorage.getItem('quant_map_allow_default_marker_delete_button') !== '0');
    } catch {
      setAllowDefaultMarkerEditing(false);
      setAllowDefaultMarkerAddButton(true);
      setAllowDefaultMarkerEditButton(true);
      setAllowDefaultMarkerDeleteButton(true);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'quant_map_allow_default_marker_editing',
        allowDefaultMarkerEditing ? '1' : '0'
      );
      window.localStorage.setItem(
        'quant_map_allow_default_marker_add_button',
        allowDefaultMarkerAddButton ? '1' : '0'
      );
      window.localStorage.setItem(
        'quant_map_allow_default_marker_edit_button',
        allowDefaultMarkerEditButton ? '1' : '0'
      );
      window.localStorage.setItem(
        'quant_map_allow_default_marker_delete_button',
        allowDefaultMarkerDeleteButton ? '1' : '0'
      );
    } catch {
      // ignore storage errors
    }
  }, [
    allowDefaultMarkerEditing,
    allowDefaultMarkerAddButton,
    allowDefaultMarkerEditButton,
    allowDefaultMarkerDeleteButton
  ]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('quant_map_custom_icons_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setCustomIconLibrary(parsed.filter((value): value is string => typeof value === 'string' && value.startsWith('data:image/')));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('quant_map_custom_icons_v1', JSON.stringify(customIconLibrary.slice(0, 80)));
    } catch {
      // ignore storage errors
    }
  }, [customIconLibrary]);

  useEffect(() => {
    try {
      setAllowPointAdd(window.localStorage.getItem('quant_map_allow_point_add') !== '0');
      setAllowZoneAdd(window.localStorage.getItem('quant_map_allow_zone_add') !== '0');
      setAllowZoneEdit(window.localStorage.getItem('quant_map_allow_zone_edit') !== '0');
      const rawFilter = window.localStorage.getItem('quant_map_filter_state_v1');
      if (rawFilter) {
        const parsed = JSON.parse(rawFilter) as {
          showDefaultMarkers?: boolean;
          showUserPoints?: boolean;
          showZones?: boolean;
          selectedLayers?: string[];
          userLabelFilter?: string;
          zoneFilter?: string;
          layerSearch?: string;
        };
        if (typeof parsed.showDefaultMarkers === 'boolean') setShowDefaultMarkers(parsed.showDefaultMarkers);
        if (typeof parsed.showUserPoints === 'boolean') setShowUserPoints(parsed.showUserPoints);
        if (typeof parsed.showZones === 'boolean') setShowZones(parsed.showZones);
        if (Array.isArray(parsed.selectedLayers)) {
          setSelectedLayers(parsed.selectedLayers.filter((v): v is string => typeof v === 'string'));
        }
        if (typeof parsed.userLabelFilter === 'string') setUserLabelFilter(parsed.userLabelFilter);
        if (typeof parsed.zoneFilter === 'string') setZoneFilter(parsed.zoneFilter);
        if (typeof parsed.layerSearch === 'string') setLayerSearch(parsed.layerSearch);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('quant_map_allow_point_add', allowPointAdd ? '1' : '0');
      window.localStorage.setItem('quant_map_allow_zone_add', allowZoneAdd ? '1' : '0');
      window.localStorage.setItem('quant_map_allow_zone_edit', allowZoneEdit ? '1' : '0');
      window.localStorage.setItem(
        'quant_map_filter_state_v1',
        JSON.stringify({
          showDefaultMarkers,
          showUserPoints,
          showZones,
          selectedLayers,
          userLabelFilter,
          zoneFilter,
          layerSearch
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    allowPointAdd,
    allowZoneAdd,
    allowZoneEdit,
    showDefaultMarkers,
    showUserPoints,
    showZones,
    selectedLayers,
    userLabelFilter,
    zoneFilter,
    layerSearch
  ]);

  const tileRange = useMemo(() => {
    const maxTileX = Math.max(0, Math.ceil(sourceWorldWidth / TILE_SIZE) - 1);
    const maxTileY = Math.max(0, Math.ceil(sourceWorldHeight / TILE_SIZE) - 1);
    const startX = Math.max(0, Math.floor(viewport.scrollLeft / renderedTileSize) - 1);
    const endX = Math.min(
      maxTileX,
      Math.floor((viewport.scrollLeft + viewport.width) / renderedTileSize) + 1
    );
    const startY = Math.max(0, Math.floor(viewport.scrollTop / renderedTileSize) - 1);
    const endY = Math.min(
      maxTileY,
      Math.floor((viewport.scrollTop + viewport.height) / renderedTileSize) + 1
    );
    return { startX, endX, startY, endY };
  }, [viewport, renderedTileSize, sourceWorldWidth, sourceWorldHeight]);

  const visibleTiles = useMemo(() => {
    const tiles: Array<{ x: number; y: number; src: string }> = [];
    for (let x = tileRange.startX; x <= tileRange.endX; x += 1) {
      for (let y = tileRange.startY; y <= tileRange.endY; y += 1) {
        tiles.push({
          x,
          y,
          src: chrome.runtime.getURL(`${mapVariant}/${sourceZoom}/${x}/${y}.jpg`)
        });
      }
    }
    return tiles;
  }, [tileRange, sourceZoom, mapVariant]);

  async function reloadUserPoints() {
    const points = await getMapUserPoints();
    setUserPoints(points);
  }

  async function reloadZones() {
    const list = await getMapZones();
    setZones(list);
  }

  function resolveIconSource(iconUrl: string | null | undefined): string | null {
    if (!iconUrl) return null;
    if (iconUrl.startsWith('data:') || iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
      return iconUrl;
    }
    const normalized = iconUrl.startsWith('/') ? iconUrl : `/${iconUrl}`;
    if (normalized.startsWith('/media/')) {
      return `https://quantfun.com.ua${normalized}`;
    }
    return chrome.runtime.getURL(normalized.replace(/^\/+/, ''));
  }

  function getRemoteFallback(iconUrl: string | null | undefined): string | null {
    if (!iconUrl) return null;
    if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://') || iconUrl.startsWith('data:')) return null;
    const normalized = iconUrl.startsWith('/') ? iconUrl : `/${iconUrl}`;
    if (normalized.startsWith('/media/')) {
      return chrome.runtime.getURL(`map-cache/files${normalized}`);
    }
    return `https://quantfun.com.ua${normalized}`;
  }

  function getUserPointIconSource(point: MapUserPoint): string | null {
    if (point.customIconDataUrl) return point.customIconDataUrl;
    if (point.iconUrl) return resolveIconSource(point.iconUrl);
    if (point.icon.startsWith('/')) return resolveIconSource(point.icon);
    return null;
  }

  function openCreateEditor(
    x: number,
    y: number,
    defaults?: { filterLabel?: string; zoneId?: string | null }
  ) {
    setPointEditorPickMode(false);
    setPointEditor({
      mode: 'create',
      sourceMarkerId: null,
      x,
      y,
      title: '',
      iconMode: 'preset',
      iconUrl: allPresetIconUrls[0] ?? null,
      customIconDataUrl: null,
      detailImageDataUrl: null,
      zoneId: defaults?.zoneId ?? null,
      filterLabel: defaults?.filterLabel ?? '',
      note: '',
      color: '#f59e0b'
    });
  }

  function openEditEditor(point: MapUserPoint) {
    setPointEditorPickMode(false);
    setPointEditor({
      mode: 'edit',
      id: point.id,
      sourceMarkerId: null,
      x: point.x,
      y: point.y,
      title: point.title,
      iconMode: point.customIconDataUrl ? 'custom' : 'preset',
      iconUrl: point.iconUrl,
      customIconDataUrl: point.customIconDataUrl,
      detailImageDataUrl: point.detailImageDataUrl ?? null,
      zoneId: point.zoneId ?? null,
      filterLabel: point.filterLabel ?? '',
      note: point.note ?? '',
      color: point.color || '#f59e0b'
    });
  }

  function openDefaultMarkerEditor(marker: DefaultMapMarker, override: MapUserPoint | null = null) {
    setPointEditorPickMode(false);
    setPointEditor({
      mode: 'edit-default',
      id: override?.id,
      sourceMarkerId: marker.id,
      x: override?.x ?? marker.x,
      y: override?.y ?? marker.y,
      title: override?.title ?? marker.title,
      iconMode: override?.customIconDataUrl ? 'custom' : 'preset',
      iconUrl: override?.iconUrl ?? marker.iconUrl,
      customIconDataUrl: override?.customIconDataUrl ?? null,
      detailImageDataUrl: override?.detailImageDataUrl ?? null,
      zoneId: null,
      filterLabel: override?.filterLabel ?? marker.layerName,
      note: override?.note ?? '',
      color: override?.color || '#f59e0b'
    });
  }

  function startEditZone(zone: MapZone) {
    setZoneDraftMode('edit');
    setZonePointPickMode(false);
    setZoneDraftPoints(zone.points);
    setZoneDraftMeta({
      id: zone.id,
      name: zone.name,
      color: zone.color,
      opacity: zone.opacity ?? 0.2,
      imageDataUrl: zone.imageDataUrl ?? null,
      imageX: zone.imageX ?? null,
      imageY: zone.imageY ?? null,
      imageWidth: zone.imageWidth ?? null,
      imageHeight: zone.imageHeight ?? null,
      imageRotation: zone.imageRotation ?? 0,
      imageOpacity: zone.imageOpacity ?? 0.35,
      cropTop: zone.cropTop ?? 0,
      cropRight: zone.cropRight ?? 0,
      cropBottom: zone.cropBottom ?? 0,
      cropLeft: zone.cropLeft ?? 0
    });
    setZoneModalOpen(false);
  }

  async function saveZoneFromDraft() {
    if ((zoneDraftMode === 'create' && !allowZoneAdd) || (zoneDraftMode === 'edit' && !allowZoneEdit)) return;
    if (zoneDraftPoints.length < 4) return;
    const nowMeta = zoneDraftMeta.name.trim()
      ? zoneDraftMeta
      : { ...zoneDraftMeta, name: `Зона ${zones.length + 1}` };
    const saved = await saveMapZone({
      id: nowMeta.id,
      name: nowMeta.name.trim(),
      color: nowMeta.color,
      opacity: nowMeta.opacity,
      points: zoneDraftPoints,
      imageDataUrl: nowMeta.imageDataUrl,
      imageX: nowMeta.imageX,
      imageY: nowMeta.imageY,
      imageWidth: nowMeta.imageWidth,
      imageHeight: nowMeta.imageHeight,
      imageRotation: nowMeta.imageRotation,
      imageOpacity: nowMeta.imageOpacity,
      cropTop: nowMeta.cropTop,
      cropRight: nowMeta.cropRight,
      cropBottom: nowMeta.cropBottom,
      cropLeft: nowMeta.cropLeft
    });
    await reloadZones();
    setShowZones(true);
    setZoneFilter('all');
    setZoneDraftMode('none');
    setZonePointPickMode(false);
    setZoneDraftPoints([]);
    setZoneDraftMeta({
      name: '',
      color: '#22c55e',
      opacity: 0.2,
      imageDataUrl: null,
      imageX: null,
      imageY: null,
      imageWidth: null,
      imageHeight: null,
      imageRotation: 0,
      imageOpacity: 0.35,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0
    });
    setZoneModalOpen(false);
  }

  async function saveEditorPoint() {
    if (!pointEditor) return;
    const title = pointEditor.title.trim();
    if (!title) {
      setError('Назва точки обов’язкова');
      return;
    }

    const iconUrl = pointEditor.iconMode === 'preset' ? pointEditor.iconUrl : null;
    const customIconDataUrl =
      pointEditor.iconMode === 'custom' ? pointEditor.customIconDataUrl : null;
    const existingDefaultOverride =
      pointEditor.mode === 'edit-default' && pointEditor.sourceMarkerId
        ? markerOverrides.get(pointEditor.sourceMarkerId) ?? null
        : null;

    await saveMapUserPoint({
      id: pointEditor.id,
      x: pointEditor.x,
      y: pointEditor.y,
      title,
      icon: iconUrl ?? 'pin',
      iconUrl,
      customIconDataUrl,
      detailImageDataUrl: pointEditor.detailImageDataUrl ?? null,
      zoneId: pointEditor.mode === 'edit-default' ? null : pointEditor.zoneId ?? null,
      filterLabel: pointEditor.filterLabel.trim() || null,
      color: pointEditor.color || '#f59e0b',
      note: pointEditor.note.trim() || null,
      sourceMarkerId: pointEditor.mode === 'edit-default' ? pointEditor.sourceMarkerId ?? null : null,
      hidden: existingDefaultOverride?.hidden ?? false
    });

    setPointEditor(null);
    setPointEditorPickMode(false);
    setError(null);
    await reloadUserPoints();
  }

  async function handleCustomIconUpload(file: File | null) {
    if (!file || !pointEditor) return;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Помилка читання файлу'));
      reader.readAsDataURL(file);
    });
    setPointEditor({
      ...pointEditor,
      iconMode: 'custom',
      customIconDataUrl: dataUrl
    });
    setCustomIconLibrary((prev) => [dataUrl, ...prev.filter((item) => item !== dataUrl)].slice(0, 80));
  }

  async function handlePointDetailImageUpload(file: File | null) {
    if (!file || !pointEditor) return;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Помилка читання файлу'));
      reader.readAsDataURL(file);
    });
    setPointEditor({
      ...pointEditor,
      detailImageDataUrl: dataUrl
    });
  }

  async function handleZoneImageUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Помилка читання файлу'));
      reader.readAsDataURL(file);
    });
    setZoneDraftMeta((prev) => ({
      ...prev,
      imageDataUrl: dataUrl,
      imageX:
        prev.imageX ??
        (() => {
          const width = prev.imageWidth ?? 1500;
          const center = getPolygonBoundsCenter(zoneDraftPoints);
          return center.x - Math.round(width / 2);
        })(),
      imageY:
        prev.imageY ??
        (() => {
          const height = prev.imageHeight ?? 1500;
          const center = getPolygonBoundsCenter(zoneDraftPoints);
          return center.y - Math.round(height / 2);
        })(),
      imageWidth: prev.imageWidth ?? 1500,
      imageHeight: prev.imageHeight ?? 1500
    }));
  }

  async function removePoint(point: MapUserPoint) {
    if (!point.id) return;
    if (!window.confirm(`Видалити точку "${point.title}"?`)) return;
    await deleteMapUserPoint(point.id);
    await reloadUserPoints();
  }

  async function removeZone(zone: MapZone) {
    if (!allowZoneEdit) return;
    if (!window.confirm(`Видалити зону "${zone.name}"?`)) return;
    await deleteMapZone(zone.id);
    await reloadZones();
    if (zoneFilter === zone.id) setZoneFilter('all');
    if (zoneDraftMeta.id === zone.id) {
      setZoneDraftMode('none');
      setZonePointPickMode(false);
      setZoneDraftPoints([]);
      setZoneModalOpen(false);
      setZoneDraftMeta({
        name: '',
        color: '#22c55e',
        opacity: 0.2,
        imageDataUrl: null,
        imageX: null,
        imageY: null,
        imageWidth: null,
        imageHeight: null,
        imageRotation: 0,
        imageOpacity: 0.35,
        cropTop: 0,
        cropRight: 0,
        cropBottom: 0,
        cropLeft: 0
      });
    }
  }

  async function clearDefaultMarkerOverride(sourceMarkerId: string) {
    const override = userPoints.find((point) => point.sourceMarkerId === sourceMarkerId);
    if (!override?.id) return;
    await deleteMapUserPoint(override.id);
    await reloadUserPoints();
  }

  async function hideDefaultMarker(marker: DefaultMapMarker) {
    const relatedOverrides = userPoints.filter((point) => point.sourceMarkerId === marker.id);
    if (relatedOverrides.length > 0) {
      await Promise.all(
        relatedOverrides.map((point) =>
          saveMapUserPoint({
            ...point,
            hidden: true
          })
        )
      );
      await reloadUserPoints();
      return;
    }
    await saveMapUserPoint({
      x: marker.x,
      y: marker.y,
      title: marker.title,
      icon: 'pin',
      iconUrl: marker.iconUrl,
      customIconDataUrl: null,
      detailImageDataUrl: null,
      zoneId: null,
      filterLabel: marker.layerName,
      color: '#f59e0b',
      note: null,
      sourceMarkerId: marker.id,
      hidden: true
    });
    await reloadUserPoints();
  }

  async function setDefaultMarkerVisibility(marker: DefaultMapMarker, visible: boolean) {
    const markerId = marker.id;
    setPendingSystemMarkerVisibility((prev) => ({ ...prev, [markerId]: visible }));
    setSavingSystemMarkerVisibility((prev) => ({ ...prev, [markerId]: true }));
    const relatedOverrides = userPoints.filter((point) => point.sourceMarkerId === marker.id);
    try {
      if (visible) {
        if (!relatedOverrides.some((point) => point.hidden)) return;
        await Promise.all(
          relatedOverrides.map((point) =>
            saveMapUserPoint({
              ...point,
              hidden: false
            })
          )
        );
        await reloadUserPoints();
        return;
      }
      await hideDefaultMarker(marker);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося змінити видимість точки');
    } finally {
      setPendingSystemMarkerVisibility((prev) => {
        const next = { ...prev };
        delete next[markerId];
        return next;
      });
      setSavingSystemMarkerVisibility((prev) => {
        const next = { ...prev };
        delete next[markerId];
        return next;
      });
    }
  }

  async function unhideAllDefaultMarkers() {
    const hiddenOverrides = userPoints.filter((point) => point.sourceMarkerId && point.hidden);
    await Promise.all(
      hiddenOverrides.map((point) =>
        saveMapUserPoint({
          ...point,
          hidden: false
        })
      )
    );
    await reloadUserPoints();
  }

  async function setCategoryMarkersVisibility(layers: string[], visible: boolean) {
    const layerSet = new Set(layers);
    const markers = defaultMarkers.filter((marker) => layerSet.has(marker.layerName));
    if (!markers.length) return;

    setPendingSystemMarkerVisibility((prev) => {
      const next = { ...prev };
      for (const marker of markers) next[marker.id] = visible;
      return next;
    });
    setSavingSystemMarkerVisibility((prev) => {
      const next = { ...prev };
      for (const marker of markers) next[marker.id] = true;
      return next;
    });

    try {
      if (visible) {
        const updates: Promise<unknown>[] = [];
        for (const marker of markers) {
          const relatedOverrides = userPoints.filter((point) => point.sourceMarkerId === marker.id);
          if (!relatedOverrides.some((point) => point.hidden)) continue;
          for (const point of relatedOverrides) {
            updates.push(
              saveMapUserPoint({
                ...point,
                hidden: false
              })
            );
          }
        }
        await Promise.all(updates);
      } else {
        const updates: Promise<unknown>[] = [];
        for (const marker of markers) {
          const relatedOverrides = userPoints.filter((point) => point.sourceMarkerId === marker.id);
          if (relatedOverrides.length > 0) {
            for (const point of relatedOverrides) {
              updates.push(
                saveMapUserPoint({
                  ...point,
                  hidden: true
                })
              );
            }
            continue;
          }
          updates.push(
            saveMapUserPoint({
              x: marker.x,
              y: marker.y,
              title: marker.title,
              icon: 'pin',
              iconUrl: marker.iconUrl,
              customIconDataUrl: null,
              detailImageDataUrl: null,
              zoneId: null,
              filterLabel: marker.layerName,
              color: '#f59e0b',
              note: null,
              sourceMarkerId: marker.id,
              hidden: true
            })
          );
        }
        await Promise.all(updates);
      }
      await reloadUserPoints();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося змінити видимість категорії');
    } finally {
      setPendingSystemMarkerVisibility((prev) => {
        const next = { ...prev };
        for (const marker of markers) delete next[marker.id];
        return next;
      });
      setSavingSystemMarkerVisibility((prev) => {
        const next = { ...prev };
        for (const marker of markers) delete next[marker.id];
        return next;
      });
    }
  }

  function applyZoomByPoint(
    nextZoom: number,
    clientX: number,
    clientY: number,
    options?: { keepVerticalScroll?: boolean }
  ) {
    const element = mapRef.current;
    if (!element) return;
    const boundedZoom = normalizeMapZoom(
      Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, nextZoom))
    );
    if (Math.abs(boundedZoom - zoom) < 0.001) return;

    const rect = element.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const offsetX = Math.max(0, Math.floor((element.clientWidth - worldWidth) / 2));
    const offsetY = Math.max(0, Math.floor((element.clientHeight - worldHeight) / 2));
    const oldScale = scale;
    const worldX = (element.scrollLeft + pointX - offsetX) / oldScale;
    const worldY = (element.scrollTop + pointY - offsetY) / oldScale;
    const nextScale = 2 ** (boundedZoom - MAP_MAX_ZOOM);
    const nextWorldWidth = Math.ceil(MAP_WIDTH * nextScale);
    const nextWorldHeight = Math.ceil(MAP_HEIGHT * nextScale);
    const nextOffsetX = Math.max(0, Math.floor((element.clientWidth - nextWorldWidth) / 2));
    const nextOffsetY = Math.max(0, Math.floor((element.clientHeight - nextWorldHeight) / 2));

    setZoom(boundedZoom);
    const keepVerticalScroll = options?.keepVerticalScroll === true;
    const prevScrollTop = element.scrollTop;
    requestAnimationFrame(() => {
      const maxLeft = Math.max(0, nextWorldWidth - element.clientWidth);
      const maxTop = Math.max(0, nextWorldHeight - element.clientHeight);
      element.scrollLeft = Math.max(
        0,
        Math.min(
          worldX * nextScale + nextOffsetX - pointX,
          maxLeft
        )
      );
      if (keepVerticalScroll) {
        element.scrollTop = maxTop > 0 ? Math.max(0, Math.min(prevScrollTop, maxTop)) : 0;
      } else {
        element.scrollTop = Math.max(
          0,
          Math.min(
            worldY * nextScale + nextOffsetY - pointY,
            maxTop
          )
        );
      }
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const element = mapRef.current;
    if (!element) return;

    wheelZoomDirectionRef.current = event.deltaY > 0 ? -1 : 1;
    wheelClientPointRef.current = { x: event.clientX, y: event.clientY };
    if (wheelZoomRafRef.current != null) return;

    wheelZoomRafRef.current = window.requestAnimationFrame(() => {
      wheelZoomRafRef.current = null;
      const rect = element.getBoundingClientRect();
      const wheelPoint = wheelClientPointRef.current;
      const targetX = wheelPoint?.x ?? rect.left + rect.width / 2;
      const targetY = wheelPoint?.y ?? rect.top + rect.height / 2;
      const direction = wheelZoomDirectionRef.current > 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP;
      applyZoomByPoint(normalizeMapZoom(zoom + direction), targetX, targetY);
    });
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (!event) return;
    if (event.button !== 0 || addMode) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button,input,select,textarea,a,label')) return;
    event?.preventDefault?.();
    const element = mapRef.current;
    if (!element) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: element.scrollLeft,
      startTop: element.scrollTop
    };
  }

  function stopDragging() {
    dragRef.current.active = false;
    panTargetRef.current = null;
    if (panAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(panAnimationFrameRef.current);
      panAnimationFrameRef.current = null;
    }
  }

  useEffect(() => {
    const onWindowMouseMove = (event: globalThis.MouseEvent) => {
      if (draggingZonePointIndex != null) {
        const element = mapRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const offsetX = Math.max(0, Math.floor((element.clientWidth - worldWidth) / 2));
        const offsetY = Math.max(0, Math.floor((element.clientHeight - worldHeight) / 2));
        const px = event.clientX - rect.left + element.scrollLeft - offsetX;
        const py = event.clientY - rect.top + element.scrollTop - offsetY;
        const x = Math.max(0, Math.min(MAP_WIDTH, Math.round(px / scale)));
        const y = Math.max(0, Math.min(MAP_HEIGHT, Math.round(py / scale)));
        setZoneDraftPoints((prev) =>
          prev.map((point, idx) => (idx === draggingZonePointIndex ? { x, y } : point))
        );
        return;
      }
      if (!dragRef.current.active) return;
      const element = mapRef.current;
      if (!element) return;
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragRef.current.moved = true;
      }
      const nextLeft = dragRef.current.startLeft - dx;
      const nextTop = dragRef.current.startTop - dy;
      const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollLeft = Math.max(0, Math.min(nextLeft, maxLeft));
      element.scrollTop = Math.max(0, Math.min(nextTop, maxTop));
    };

    const onWindowMouseUp = () => {
      setDraggingZonePointIndex(null);
      stopDragging();
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [addMode, draggingZonePointIndex, scale]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element || loading || initialCenterDoneRef.current) return;
    if (element.clientWidth < 40 || element.clientHeight < 40) return;
    element.scrollLeft = Math.max(0, Math.floor((worldWidth - element.clientWidth) / 2));
    element.scrollTop = Math.max(0, Math.floor((worldHeight - element.clientHeight) / 2));
    initialCenterDoneRef.current = true;
  }, [loading, worldWidth, worldHeight]);

  useEffect(() => {
    initialCenterDoneRef.current = false;
  }, [isPageExpanded, isFullscreen, mapVariant]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;

    const onNativeWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onNativeWheel);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mapFocusPingTimeoutRef.current != null) {
        window.clearTimeout(mapFocusPingTimeoutRef.current);
      }
      if (wheelZoomRafRef.current != null) {
        window.cancelAnimationFrame(wheelZoomRafRef.current);
      }
    };
  }, []);

  async function toggleFullscreen() {
    const element = mapRef.current;
    if (!element) return;
    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  }

  function getMapCoordsFromClient(target: HTMLDivElement, clientX: number, clientY: number) {
    const rect = target.getBoundingClientRect();
    const offsetX = Math.max(0, Math.floor((target.clientWidth - worldWidth) / 2));
    const offsetY = Math.max(0, Math.floor((target.clientHeight - worldHeight) / 2));
    const px = clientX - rect.left + target.scrollLeft - offsetX;
    const py = clientY - rect.top + target.scrollTop - offsetY;
    return {
      x: Math.max(0, Math.min(MAP_WIDTH, Math.round(px / scale))),
      y: Math.max(0, Math.min(MAP_HEIGHT, Math.round(py / scale)))
    };
  }

  function mapClick(event: MouseEvent<HTMLDivElement>) {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    if (zoneDraftMode !== 'none' && zonePointPickMode) {
      if ((zoneDraftMode === 'create' && !allowZoneAdd) || (zoneDraftMode === 'edit' && !allowZoneEdit)) return;
      const coords = getMapCoordsFromClient(event.currentTarget, event.clientX, event.clientY);
      setZoneDraftPoints((prev) => {
        const next = [...prev, coords];
        if (next.length === 4) {
          const addMore = window.confirm('Додано 4 точки. Додаємо ще одну?');
          if (addMore) {
            return next;
          }
          setZonePointPickMode(false);
          setZoneModalOpen(true);
          const saveNow = window.confirm('Зберегти зону зараз?');
          if (saveNow) {
            void saveZoneFromDraft();
          }
        }
        return next;
      });
      return;
    }
    if (movingDefaultMarkerId) {
      const marker = defaultMarkers.find((item) => item.id === movingDefaultMarkerId);
      if (marker) {
        const override = markerOverrides.get(marker.id) ?? null;
        const coords = getMapCoordsFromClient(event.currentTarget, event.clientX, event.clientY);
        openDefaultMarkerEditor(marker, override ? { ...override, x: coords.x, y: coords.y } : null);
      }
      setMovingDefaultMarkerId(null);
      return;
    }
    if (!addMode || !allowPointAdd) return;
    const coords = getMapCoordsFromClient(event.currentTarget, event.clientX, event.clientY);
    openCreateEditor(coords.x, coords.y);
    setAddMode(false);
  }

  function centerMapOnPoint(x: number, y: number) {
    const element = mapRef.current;
    if (!element) return;
    const offsetX = Math.max(0, Math.floor((element.clientWidth - worldWidth) / 2));
    const offsetY = Math.max(0, Math.floor((element.clientHeight - worldHeight) / 2));
    const worldX = x * scale;
    const worldY = y * scale;
    const targetLeft = Math.max(0, worldX + offsetX - element.clientWidth / 2);
    const targetTop = Math.max(0, worldY + offsetY - element.clientHeight / 2);
    element.scrollLeft = Math.min(targetLeft, Math.max(0, worldWidth - element.clientWidth));
    element.scrollTop = Math.min(targetTop, Math.max(0, worldHeight - element.clientHeight));
  }

  function focusMapPointFromList(x: number, y: number) {
    setLayerFilterOpen(false);
    centerMapOnPoint(x, y);
    setMapFocusPing({ x, y });
    if (mapFocusPingTimeoutRef.current != null) {
      window.clearTimeout(mapFocusPingTimeoutRef.current);
    }
    mapFocusPingTimeoutRef.current = window.setTimeout(() => {
      setMapFocusPing(null);
      mapFocusPingTimeoutRef.current = null;
    }, 1400);
  }

  function mapDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (!pointEditorPickMode || !pointEditor) return;
    const coords = getMapCoordsFromClient(event.currentTarget, event.clientX, event.clientY);
    setPointEditor({
      ...pointEditor,
      x: coords.x,
      y: coords.y
    });
    setPointEditorPickMode(false);
  }

  function mapContextMenu(event: MouseEvent<HTMLDivElement>) {
    event?.preventDefault?.();
    const coords = getMapCoordsFromClient(event.currentTarget, event.clientX, event.clientY);
    const zoneAtPoint = [...zones].reverse().find((zone) => pointInPolygon({ x: coords.x, y: coords.y }, zone.points));
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      mapX: coords.x,
      mapY: coords.y,
      pointId: null,
      defaultMarkerId: null,
      zoneId: zoneAtPoint?.id ?? null
    });
  }

  function pointContextMenu(event: MouseEvent<HTMLButtonElement>, point: MapUserPoint) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      mapX: point.x,
      mapY: point.y,
      pointId: point.id ?? null,
      defaultMarkerId: null,
      zoneId: null
    });
  }

  function defaultMarkerContextMenu(event: MouseEvent<HTMLButtonElement>, marker: DefaultMapMarker) {
    if (!allowDefaultMarkerEditing) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const override = markerOverrides.get(marker.id);
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      mapX: override?.x ?? marker.x,
      mapY: override?.y ?? marker.y,
      pointId: null,
      defaultMarkerId: marker.id,
      zoneId: null
    });
  }

  function toggleLayer(layerName: string) {
    setSelectedLayers((prev) =>
      prev.includes(layerName) ? prev.filter((name) => name !== layerName) : [...prev, layerName]
    );
  }

  const contextPoint =
    contextMenu.pointId != null ? userPoints.find((point) => point.id === contextMenu.pointId) ?? null : null;
  const contextDefaultMarker =
    contextMenu.defaultMarkerId != null
      ? defaultMarkers.find((marker) => marker.id === contextMenu.defaultMarkerId) ?? null
      : null;
  const contextDefaultOverride = contextDefaultMarker
    ? markerOverrides.get(contextDefaultMarker.id) ?? null
    : null;
  const contextZone = contextMenu.zoneId ? zones.find((zone) => zone.id === contextMenu.zoneId) ?? null : null;

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 ${
        isPageExpanded ? 'fixed inset-2 z-50 overflow-auto' : ''
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Офлайн карта</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300">
            Zoom: {zoom.toFixed(1)}
          </span>
          <button
            type="button"
            onClick={(e) => applyZoomByPoint(zoom - MAP_ZOOM_STEP, e.clientX, e.clientY)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            -
          </button>
          <button
            type="button"
            onClick={(e) => applyZoomByPoint(zoom + MAP_ZOOM_STEP, e.clientX, e.clientY)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
            title="Налаштування карти"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setLayerFilterOpen((prev) => !prev)}
            className={`rounded-md border px-3 py-1 text-xs ${
              layerFilterOpen
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            Фільтр
          </button>
          <button
            type="button"
            onClick={() => setMapVariant((prev) => (prev === 'map' ? 'mapg' : 'map'))}
            className={`rounded-md border px-3 py-1 text-xs ${
              mapVariant === 'mapg'
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Змінити вигляд карти"
          >
            Вид: {mapVariant === 'mapg' ? 'альт.' : 'норм.'}
          </button>
          <button
            type="button"
            onClick={() => allowPointAdd && setAddMode((v) => !v)}
            disabled={!allowPointAdd}
            className={`rounded-md border px-3 py-1 text-xs ${
              addMode
                ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            {!allowPointAdd ? 'Додавання точки вимкнено' : addMode ? 'Клікни по карті...' : 'Додати точку'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!allowZoneAdd) return;
              setZoneDraftMode('create');
              setZoneDraftPoints([]);
              setZonePointPickMode(true);
              setZoneDraftMeta({
                name: '',
                color: '#22c55e',
                opacity: 0.2,
                imageDataUrl: null,
                imageX: null,
                imageY: null,
                imageWidth: null,
                imageHeight: null,
                imageRotation: 0,
                imageOpacity: 0.35,
                cropTop: 0,
                cropRight: 0,
                cropBottom: 0,
                cropLeft: 0
              });
              setZoneModalOpen(false);
            }}
            disabled={!allowZoneAdd}
            className={`rounded-md border px-3 py-1 text-xs ${
              zoneDraftMode === 'create'
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Створити зону (сплайн)"
          >
            {allowZoneAdd ? 'Додати зону' : 'Додавання зони вимкнено'}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className={`rounded-md border px-3 py-1 text-xs ${
              isFullscreen
                ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="На весь екран"
          >
            {isFullscreen ? 'Вийти з fullscreen' : 'Fullscreen'}
          </button>
          <button
            type="button"
            onClick={() => setIsPageExpanded((prev) => !prev)}
            className={`rounded-md border px-3 py-1 text-xs ${
              isPageExpanded
                ? 'border-violet-400 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Розгорнути в межах сторінки"
          >
            {isPageExpanded ? 'Згорнути сторінку' : 'На сторінку'}
          </button>
        </div>
      </div>

      {layerFilterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs shadow-2xl shadow-black/60">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">Фільтр шарів та категорій</h3>
              <button
                type="button"
                onClick={() => setLayerFilterOpen(false)}
                className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800"
              >
                Закрити
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDefaultMarkers((prev) => !prev)}
                className={`rounded-md border px-2 py-1 ${
                  showDefaultMarkers
                    ? 'border-sky-400 bg-sky-500/10 text-sky-300'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                Системні точки
              </button>
              <button
                type="button"
                onClick={() => setShowUserPoints((prev) => !prev)}
                className={`rounded-md border px-2 py-1 ${
                  showUserPoints
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                Мої точки
              </button>
              <label className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-1 text-slate-200">
                <input
                  type="checkbox"
                  checked={showZones}
                  onChange={(e) => setShowZones(e.target.checked)}
                />
                Показати зони
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!allowZoneAdd) return;
                  setZoneDraftMode('create');
                  setZoneDraftPoints([]);
                  setZonePointPickMode(true);
                  setZoneDraftMeta({
                    name: '',
                    color: '#22c55e',
                    opacity: 0.2,
                    imageDataUrl: null,
                    imageX: null,
                    imageY: null,
                    imageWidth: null,
                    imageHeight: null,
                    imageRotation: 0,
                    imageOpacity: 0.35,
                    cropTop: 0,
                    cropRight: 0,
                    cropBottom: 0,
                    cropLeft: 0
                  });
                  setZoneModalOpen(false);
                }}
                disabled={!allowZoneAdd}
                className="rounded-md border border-emerald-500/70 px-3 py-1 text-emerald-300 hover:bg-emerald-500/10"
              >
                Нова зона
              </button>
              <button
                type="button"
                disabled={zoneDraftMode === 'none' || zoneDraftPoints.length < 4}
                onClick={() => {
                  setZoneDraftMeta((prev) => ({
                    ...prev,
                    name:
                      prev.name ||
                      (zoneDraftMode === 'edit'
                        ? prev.name || 'Зона'
                        : `Нова зона ${zones.length + 1}`)
                  }));
                  setZoneModalOpen(true);
                }}
                className={`rounded-md border px-3 py-1 ${
                  zoneDraftMode !== 'none' && zoneDraftPoints.length >= 4
                    ? 'border-blue-400 text-blue-200 hover:bg-blue-500/10'
                    : 'border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="Завершити зону"
              >
                Завершити зону
              </button>
              <button
                type="button"
                disabled={zoneDraftMode === 'none'}
                onClick={() => {
                  setZoneDraftMode('none');
                  setZoneDraftPoints([]);
                  setZonePointPickMode(false);
                  setZoneDraftMeta((prev) => ({
                    ...prev,
                    id: undefined,
                    name: '',
                    color: '#22c55e'
                  }));
                }}
                className={`rounded-md border px-3 py-1 ${
                  zoneDraftMode !== 'none'
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Скасувати зону
              </button>
              <input
                value={layerSearch}
                onChange={(e) => setLayerSearch(e.target.value)}
                className="min-w-[220px] flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 placeholder:text-slate-500"
                placeholder="Пошук по шарах/назвах..."
              />
              <select
                value={userLabelFilter}
                onChange={(e) => setUserLabelFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              >
                <option value="all">Усі мої категорії</option>
                <option value="__no_category">Без категорії</option>
                {userFilterLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              >
                <option value="all">Усі зони</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedLayers(layerNames)}
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Вибрати всі
              </button>
              <button
                type="button"
                onClick={() => void unhideAllDefaultMarkers()}
                className="rounded border border-emerald-500/60 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10"
              >
                Показати всі системні точки
              </button>
              <button
                type="button"
                onClick={() => setSelectedLayers([])}
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Очистити
              </button>
              <span className="text-slate-500">
                Обрано шарів: {selectedLayers.length}/{layerNames.length}
              </span>
            </div>

            <div className="grid max-h-[55vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {Array.from(
                layerNames.reduce((acc, layerName) => {
                  const category = baseLayerLabel(layerName) || 'Інше';
                  if (!acc.has(category)) acc.set(category, []);
                  acc.get(category)!.push(layerName);
                  return acc;
                }, new Map<string, string[]>())
              ).map(([category, layers]) => (
                <div key={category} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-100">{category}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!allowPointAdd}
                        onClick={() => {
                          if (!allowPointAdd) return;
                          const firstInCategory = defaultMarkers.find((marker) =>
                            layers.includes(marker.layerName)
                          );
                          const seedX = firstInCategory?.x ?? Math.round(MAP_WIDTH / 2);
                          const seedY = firstInCategory?.y ?? Math.round(MAP_HEIGHT / 2);
                          openCreateEditor(seedX, seedY, {
                            filterLabel: category,
                            zoneId: null
                          });
                          setAddMode(false);
                          setLayerFilterOpen(false);
                        }}
                        className="rounded border border-emerald-500/60 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                      >
                        Додати
                      </button>
                      <button
                        type="button"
                        onClick={() => void setCategoryMarkersVisibility(layers, true)}
                        className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        Увімкнути всі
                      </button>
                      <button
                        type="button"
                        onClick={() => void setCategoryMarkersVisibility(layers, false)}
                        className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        Викл. всі
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {layers.map((layerName) => (
                      <div
                        key={layerName}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedLayers.includes(layerName)}
                            onChange={() => toggleLayer(layerName)}
                          />
                          {resolveIconSource(layerIconByName.get(layerName) ?? null) ? (
                            <img
                              src={resolveIconSource(layerIconByName.get(layerName) ?? null) ?? ''}
                              alt=""
                              className="h-4 w-4 shrink-0"
                              onError={(e) => {
                                const el = e.currentTarget;
                                const remoteFallback = getRemoteFallback(layerIconByName.get(layerName) ?? null);
                                if (remoteFallback && !el.dataset.remoteTried) {
                                  el.dataset.remoteTried = '1';
                                  el.src = remoteFallback;
                                  return;
                                }
                                el.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-white/60 bg-sky-400" />
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLayerName((prev) => (prev === layerName ? null : layerName))
                            }
                            className="truncate text-left text-slate-200 hover:text-white"
                          >
                            {layerName}
                          </button>
                        </div>
                        {expandedLayerName === layerName ? (
                          <div className="mt-1 space-y-1 border-t border-slate-800 pt-1">
                            {defaultMarkers
                              .filter((marker) => marker.layerName === layerName)
                              .map((marker) => {
                                const override = markerOverrides.get(marker.id);
                                const persistedVisible = systemMarkerHiddenById.get(marker.id) !== true;
                                const visible = pendingSystemMarkerVisibility[marker.id] ?? persistedVisible;
                                const isSavingVisibility = savingSystemMarkerVisibility[marker.id] === true;
                                const title = override?.title ?? marker.title;
                                const markerX = override?.x ?? marker.x;
                                const markerY = override?.y ?? marker.y;
                                return (
                                  <div
                                    key={`layer-marker-${layerName}-${marker.id}`}
                                    className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1"
                                  >
                                    <label className="flex min-w-0 flex-1 items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={visible}
                                        disabled={isSavingVisibility}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => void setDefaultMarkerVisibility(marker, e.target.checked)}
                                      />
                                      <span className="truncate text-slate-200">{title}</span>
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => focusMapPointFromList(markerX, markerY)}
                                        className="rounded border border-slate-700 px-2 py-0.5 text-slate-200 hover:bg-slate-800"
                                        title="Перейти до точки на карті"
                                      >
                                        ⌖
                                      </button>
                                      {allowDefaultMarkerEditButton ? (
                                        <button
                                          type="button"
                                          disabled={!allowDefaultMarkerEditing}
                                          onClick={() => openDefaultMarkerEditor(marker, override ?? null)}
                                          className="rounded border border-blue-500/60 px-2 py-0.5 text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
                                        >
                                          Редагувати
                                        </button>
                                      ) : null}
                                      {allowDefaultMarkerDeleteButton ? (
                                        <button
                                          type="button"
                                          disabled={!visible}
                                          onClick={() => void setDefaultMarkerVisibility(marker, false)}
                                          className="rounded border border-rose-500/60 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                                        >
                                          Видалити
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {zones.length ? (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                <div className="mb-1 text-xs font-semibold text-slate-200">Зони</div>
                <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ backgroundColor: zone.color }}
                          aria-hidden
                        />
                        {zone.name}
                      </span>
                      <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!allowZoneEdit}
                        onClick={() => {
                          if (!allowZoneEdit) return;
                          startEditZone(zone);
                          setZoneModalOpen(true);
                        }}
                        className="rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-800"
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          disabled={!allowZoneEdit}
                          onClick={() => void removeZone(zone)}
                          className="rounded border border-rose-500/60 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {userCategoryEntries.length ? (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                <div className="mb-1 text-xs font-semibold text-slate-200">Категорії моїх точок</div>
                <div className="space-y-1">
                  {userCategoryEntries.map((entry) => {
                    const expanded = expandedUserCategory === entry.label;
                    return (
                      <div
                        key={`user-cat-${entry.label}`}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {entry.label} ({entry.points.length})
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setUserLabelFilter(entry.label === 'Без категорії' ? '__no_category' : entry.label);
                                setShowUserPoints(true);
                              }}
                              className="rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-800"
                            >
                              Відкрити
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedUserCategory((prev) => (prev === entry.label ? null : entry.label))}
                              className="rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-800"
                            >
                              {expanded ? 'Сховати' : 'Точки'}
                            </button>
                          </div>
                        </div>
                        {expanded ? (
                          <div className="mt-1 max-h-28 space-y-1 overflow-y-auto pr-1">
                            {entry.points.map((point) => (
                              <div
                                key={`user-cat-point-${entry.label}-${point.id ?? `${point.x}-${point.y}`}`}
                                className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1"
                              >
                                <span className="truncate">{point.title}</span>
                                <button
                                  type="button"
                                  onClick={() => openEditEditor(point)}
                                  className="rounded border border-blue-500/60 px-2 py-0.5 text-blue-300 hover:bg-blue-500/10"
                                >
                                  Редагувати
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-md border border-rose-700/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}
      {movingDefaultMarkerId ? (
        <div className="mb-3 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Режим зміни позиції іконки: клікни по новому місцю на карті.
          <button
            type="button"
            onClick={() => setMovingDefaultMarkerId(null)}
            className="ml-2 rounded border border-amber-500/60 px-2 py-0.5 text-[11px] hover:bg-amber-500/10"
          >
            Скасувати
          </button>
        </div>
      ) : null}
      {zoneDraftMode !== 'none' && zonePointPickMode ? (
        <div className="mb-3 rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          Режим додавання точок зони: клік по карті додає вершину.
          <button
            type="button"
            onClick={() => {
              setZonePointPickMode(false);
              setZoneModalOpen(true);
            }}
            className="ml-2 rounded border border-emerald-500/60 px-2 py-0.5 text-[11px] hover:bg-emerald-500/10"
          >
            Повернутись у модалку
          </button>
        </div>
      ) : null}

      <div
        ref={mapRef}
        className={`map-scroll-hidden relative overflow-auto rounded-xl border border-slate-800 bg-slate-950 ${
          addMode || (zoneDraftMode !== 'none' && zonePointPickMode) || pointEditorPickMode
            ? 'cursor-crosshair'
            : dragRef.current.active
              ? 'cursor-grabbing'
              : 'cursor-grab'
        }`}
        style={{
          height: isPageExpanded ? 'calc(100vh - 280px)' : '68vh',
          overscrollBehavior: 'contain'
        }}
        onClick={mapClick}
        onDoubleClick={mapDoubleClick}
        onContextMenu={mapContextMenu}
        onWheelCapture={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div className="relative select-none" style={{ width: `${mapCanvasWidth}px`, height: `${mapCanvasHeight}px` }}>
          <div
            className="absolute left-0 top-0"
            style={{
              width: `${worldWidth}px`,
              height: `${worldHeight}px`,
              transform: `translate(${mapOffsetX}px, ${mapOffsetY}px)`
            }}
          >
          {visibleTiles.map((tile) => (
            <img
              key={`tile-${sourceZoom}-${tile.x}-${tile.y}`}
              src={tile.src}
              alt=""
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
              className="absolute"
              style={{
                width: `${renderedTileSize}px`,
                height: `${renderedTileSize}px`,
                left: `${tile.x * renderedTileSize}px`,
                top: `${tile.y * renderedTileSize}px`,
                imageRendering: 'auto'
              }}
            />
          ))}

          {showZones && zones.length ? (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={worldWidth}
              height={worldHeight}
              viewBox={`0 0 ${worldWidth} ${worldHeight}`}
            >
              {zones.map((zone) => {
                const isActive = zoneFilter === 'all' || zoneFilter === zone.id;
                const zoneOpacity = Math.max(0, Math.min(1, zone.opacity ?? 0.2));
                const lowOpacity = zoneOpacity <= 0.001;
                return (
                  <path
                    key={`zone-${zone.id}`}
                    d={catmullRomPath(zone.points, scale)}
                    fill={isActive ? zone.color : 'transparent'}
                    fillOpacity={isActive ? zoneOpacity : undefined}
                    stroke={zone.color}
                    strokeWidth={isActive ? zoneStrokeWidth : zoneSecondaryStrokeWidth}
                    strokeDasharray={isActive ? (lowOpacity ? '6 6' : undefined) : '4 4'}
                    strokeOpacity={isActive ? 0.95 : 0.45}
                  />
                );
              })}
            </svg>
          ) : null}

          {zoneDraftMode !== 'none' && zoneDraftPoints.length ? (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={worldWidth}
              height={worldHeight}
              viewBox={`0 0 ${worldWidth} ${worldHeight}`}
            >
              {zoneDraftPoints.length >= 2 ? (
                <polyline
                  points={zoneDraftPoints.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')}
                  fill="none"
                  stroke="rgba(34,197,94,0.95)"
                  strokeWidth={zoneStrokeWidth}
                />
              ) : null}
              {zoneDraftPoints.length >= 3 ? (
                <polygon
                  points={zoneDraftPoints.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')}
                  fill="rgba(34,197,94,0.2)"
                  stroke="rgba(34,197,94,0.95)"
                  strokeWidth={zoneSecondaryStrokeWidth}
                />
              ) : null}
              <path
                d={catmullRomPath(zoneDraftPoints, scale)}
                fill="rgba(34,197,94,0.12)"
                stroke="rgba(34,197,94,0.75)"
                strokeWidth={zoneStrokeWidth}
              />
            </svg>
          ) : null}

          {mapFocusPing ? (
            <div
              className="pointer-events-none absolute z-40"
              style={{
                left: `${mapFocusPing.x * scale}px`,
                top: `${mapFocusPing.y * scale}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <span className="absolute -left-4 -top-4 h-8 w-8 animate-ping rounded-full border-2 border-cyan-300/80" />
              <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
            </div>
          ) : null}

          {zones.map((zone) => {
            if (!zone.imageDataUrl || !zone.imageWidth || !zone.imageHeight) return null;
            const center = getPolygonBoundsCenter(zone.points);
            const fallbackX = center.x - Math.round(zone.imageWidth / 2);
            const fallbackY = center.y - Math.round(zone.imageHeight / 2);
            const imageX = zone.imageX ?? fallbackX;
            const imageY = zone.imageY ?? fallbackY;
            const widthPx = zone.imageWidth * scale;
            const heightPx = zone.imageHeight * scale;
            const cropTop = Math.max(0, Math.min(95, zone.cropTop ?? 0));
            const cropRight = Math.max(0, Math.min(95, zone.cropRight ?? 0));
            const cropBottom = Math.max(0, Math.min(95, zone.cropBottom ?? 0));
            const cropLeft = Math.max(0, Math.min(95, zone.cropLeft ?? 0));
            const imageOpacity = Math.max(0, Math.min(1, zone.imageOpacity ?? 0.35));
            return (
              <div
                key={`zone-image-${zone.id}`}
                className="pointer-events-none absolute"
                style={{
                  left: `${imageX * scale}px`,
                  top: `${imageY * scale}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  opacity: imageOpacity,
                  transform: `rotate(${zone.imageRotation ?? 0}deg)`,
                  transformOrigin: 'center center',
                  overflow: 'hidden'
                }}
              >
                <img
                  src={zone.imageDataUrl}
                  alt=""
                  className="h-full w-full object-fill"
                  style={{
                    clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`
                  }}
                />
              </div>
            );
          })}

          {showZones && zones.length ? (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={worldWidth}
              height={worldHeight}
              viewBox={`0 0 ${worldWidth} ${worldHeight}`}
            >
              {zones.map((zone) => {
                const isActive = zoneFilter === 'all' || zoneFilter === zone.id;
                const zoneOpacity = Math.max(0, Math.min(1, zone.opacity ?? 0.2));
                const lowOpacity = zoneOpacity <= 0.001;
                return (
                  <path
                    key={`zone-top-${zone.id}`}
                    d={catmullRomPath(zone.points, scale)}
                    fill="transparent"
                    stroke={zone.color}
                    strokeWidth={isActive ? zoneStrokeWidth : zoneSecondaryStrokeWidth}
                    strokeDasharray={isActive ? (lowOpacity ? '6 6' : undefined) : '4 4'}
                    strokeOpacity={isActive ? 0.95 : 0.45}
                  />
                );
              })}
            </svg>
          ) : null}

          {zoneDraftMode !== 'none' &&
            zoneDraftPoints.map((point, idx) => (
              <button
                key={`zone-draft-point-${idx}-${point.x}-${point.y}`}
                type="button"
                onMouseDown={(e) => {
                  e?.preventDefault?.();
                  e.stopPropagation();
                  setDraggingZonePointIndex(idx);
                }}
                onClick={(e) => {
                  e?.preventDefault?.();
                  e.stopPropagation();
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-emerald-400 shadow-[0_0_0_2px_rgba(15,23,42,0.7)]"
                style={{
                  left: `${point.x * scale}px`,
                  top: `${point.y * scale}px`,
                  width: `${zonePointSize}px`,
                  height: `${zonePointSize}px`
                }}
                title={`Точка ${idx + 1}: ${point.x}, ${point.y}`}
              />
            ))}

          {!loading &&
            showDefaultMarkers &&
            visibleDefaultMarkers.map((marker) => {
              const override = markerOverrides.get(marker.id);
              const effectiveX = override?.x ?? marker.x;
              const effectiveY = override?.y ?? marker.y;
              const effectiveTitle = override?.title ?? marker.title;
              const effectiveLayer = override?.filterLabel ?? marker.layerName;
              const effectiveIconUrl = override?.iconUrl ?? marker.iconUrl;
              const effectiveCustomIcon = override?.customIconDataUrl ?? null;
              const src = effectiveCustomIcon || resolveIconSource(effectiveIconUrl);
              const remoteFallback = getRemoteFallback(effectiveIconUrl);
              return (
                <button
                  key={`m-${marker.id}`}
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => defaultMarkerContextMenu(e, marker)}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${effectiveX * scale}px`, top: `${effectiveY * scale}px` }}
                  title={`${effectiveTitle} (${effectiveLayer})`}
                >
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="h-5 w-5 drop-shadow-[0_0_4px_rgba(15,23,42,0.9)]"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (remoteFallback && !el.dataset.remoteTried) {
                          el.dataset.remoteTried = '1';
                          el.src = remoteFallback;
                          return;
                        }
                        el.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full border border-white/60 bg-sky-400 shadow-[0_0_0_2px_rgba(15,23,42,0.65)]" />
                  )}
                </button>
              );
            })}

          {showUserPoints &&
            filteredCustomPoints.map((point) => (
              <button
                key={`u-${point.id ?? `${point.x}-${point.y}`}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditEditor(point);
                }}
                onContextMenu={(e) => pointContextMenu(e, point)}
                className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${point.x * scale}px`, top: `${point.y * scale}px` }}
                title={`Моя точка: ${point.title}`}
              >
                {getUserPointIconSource(point) ? (
                  <img
                    src={getUserPointIconSource(point) ?? ''}
                    alt=""
                    className="h-6 w-6 rounded-sm drop-shadow-[0_0_4px_rgba(15,23,42,0.9)]"
                    onError={(e) => {
                      const el = e.currentTarget;
                      const remoteFallback = getRemoteFallback(point.iconUrl);
                      if (remoteFallback && !el.dataset.remoteTried) {
                        el.dataset.remoteTried = '1';
                        el.src = remoteFallback;
                        return;
                      }
                      el.style.display = 'none';
                    }}
                  />
                ) : (
                  <span
                    className="inline-flex h-3 w-3 rounded-full border border-white/70 shadow-[0_0_0_2px_rgba(15,23,42,0.65)]"
                    style={{ backgroundColor: point.color || '#f59e0b' }}
                  />
                )}
                {(point.note?.trim() || point.detailImageDataUrl) && (
                  <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden w-56 -translate-x-1/2 rounded border border-slate-700 bg-slate-950/95 p-2 text-left shadow-[0_10px_24px_rgba(2,6,23,0.55)] group-hover:block group-focus-visible:block">
                    <span className="block text-[11px] font-semibold text-slate-100">
                      {point.title}
                    </span>
                    {point.note?.trim() ? (
                      <span className="mt-1 block whitespace-pre-wrap text-[11px] leading-4 text-slate-300">
                        {point.note.trim()}
                      </span>
                    ) : null}
                    {point.detailImageDataUrl ? (
                      <img
                        src={point.detailImageDataUrl}
                        alt={point.title}
                        className="mt-2 max-h-28 w-full rounded border border-slate-700 object-contain"
                      />
                    ) : null}
                  </span>
                )}
              </button>
              ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-400">
          Default точки: {visibleDefaultMarkers.length}/{defaultMarkers.length} • Мої точки:{' '}
          {showUserPoints
            ? filteredCustomPoints.length
            : 0}
          /{filteredCustomPoints.length || customUserPoints.length}
        </div>
        <a
          href={QUANTFUN_MAP_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800"
        >
          Оригінал карти QuantFun
        </a>
      </div>

      {filteredCustomPoints.length ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
          <div className="mb-2 text-xs font-medium text-slate-300">Мої точки</div>
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-xs">
            {filteredCustomPoints.map((point) => (
              <div
                key={`list-${point.id ?? `${point.x}-${point.y}`}`}
                className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1"
              >
                <span className="truncate text-slate-200">
                  {point.title} ({point.x}, {point.y})
                  {point.filterLabel ? ` • ${point.filterLabel}` : ''}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditEditor(point)}
                    className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                  >
                    Ред.
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePoint(point)}
                    className="rounded border border-rose-500/60 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10"
                  >
                    Видалити
                  </button>
                </div>
              </div>
              ))}
          </div>
        </div>
      ) : null}

      {contextMenu.open ? (
        <div
          className="fixed z-50 min-w-[210px] rounded-lg border border-slate-700 bg-slate-900 p-1 text-xs shadow-xl shadow-black/60"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={!allowPointAdd}
            className="block w-full rounded px-2 py-1.5 text-left text-slate-200 hover:bg-slate-800"
            onClick={() => {
              if (!allowPointAdd) return;
              openCreateEditor(contextMenu.mapX, contextMenu.mapY);
              setContextMenu((prev) => ({
                ...prev,
                open: false,
                pointId: null,
                defaultMarkerId: null,
                zoneId: null
              }));
            }}
          >
            Додати точку тут
          </button>
          <button
            type="button"
            disabled={!allowZoneAdd}
            className="block w-full rounded px-2 py-1.5 text-left text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            onClick={() => {
              if (!allowZoneAdd) return;
              setZoneDraftMode('create');
              setZoneDraftPoints([{ x: contextMenu.mapX, y: contextMenu.mapY }]);
              setZonePointPickMode(true);
              setZoneDraftMeta({
                name: '',
                color: '#22c55e',
                opacity: 0.2,
                imageDataUrl: null,
                imageX: null,
                imageY: null,
                imageWidth: null,
                imageHeight: null,
                imageRotation: 0,
                imageOpacity: 0.35,
                cropTop: 0,
                cropRight: 0,
                cropBottom: 0,
                cropLeft: 0
              });
              setZoneModalOpen(false);
              setContextMenu((prev) => ({
                ...prev,
                open: false,
                pointId: null,
                defaultMarkerId: null,
                zoneId: null
              }));
            }}
          >
            Додати зону тут
          </button>
          {contextZone && allowZoneEdit ? (
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-slate-200 hover:bg-slate-800"
              onClick={() => {
                startEditZone(contextZone);
                setZoneModalOpen(true);
                setContextMenu((prev) => ({
                  ...prev,
                  open: false,
                  pointId: null,
                  defaultMarkerId: null,
                  zoneId: null
                }));
              }}
            >
              Редагувати зону
            </button>
          ) : null}
          {contextPoint ? (
            <>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  openEditEditor(contextPoint);
                  setContextMenu((prev) => ({
                    ...prev,
                    open: false,
                    pointId: null,
                    defaultMarkerId: null,
                    zoneId: null
                  }));
                }}
              >
                Редагувати точку
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  void removePoint(contextPoint);
                  setContextMenu((prev) => ({
                    ...prev,
                    open: false,
                    pointId: null,
                    defaultMarkerId: null,
                    zoneId: null
                  }));
                }}
              >
                Видалити точку
              </button>
            </>
          ) : null}
          {contextDefaultMarker && allowDefaultMarkerEditing ? (
            <>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  openDefaultMarkerEditor(contextDefaultMarker, contextDefaultOverride);
                  setContextMenu((prev) => ({
                    ...prev,
                    open: false,
                    pointId: null,
                    defaultMarkerId: null,
                    zoneId: null
                  }));
                }}
              >
                Редагувати іконку/дані
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setMovingDefaultMarkerId(contextDefaultMarker.id);
                  setContextMenu((prev) => ({
                    ...prev,
                    open: false,
                    pointId: null,
                    defaultMarkerId: null,
                    zoneId: null
                  }));
                }}
              >
                Змінити позицію
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-amber-300 hover:bg-amber-500/10"
                onClick={() => {
                  void hideDefaultMarker(contextDefaultMarker);
                  setContextMenu((prev) => ({
                    ...prev,
                    open: false,
                    pointId: null,
                    defaultMarkerId: null,
                    zoneId: null
                  }));
                }}
              >
                Приховати точку
              </button>
              {contextDefaultOverride?.id ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-rose-300 hover:bg-rose-500/10"
                  onClick={() => {
                    void clearDefaultMarkerOverride(contextDefaultMarker.id);
                    setContextMenu((prev) => ({
                      ...prev,
                      open: false,
                      pointId: null,
                      defaultMarkerId: null,
                      zoneId: null
                    }));
                  }}
                >
                  Скинути зміни іконки
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {settingsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Налаштування карти</h3>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                ?
              </button>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowDefaultMarkerEditing}
                onChange={(e) => setAllowDefaultMarkerEditing(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Дозволити редагування існуючих іконок.
                <span className="block text-xs text-slate-400">
                  Після ввімкнення можна зробити правий клік по системній іконці:
                  редагувати або змінити позицію.
                </span>
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowDefaultMarkerAddButton}
                onChange={(e) => setAllowDefaultMarkerAddButton(e.target.checked)}
                className="mt-0.5"
              />
              <span>Показувати кнопку "Додати" для системних точок.</span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowDefaultMarkerEditButton}
                onChange={(e) => setAllowDefaultMarkerEditButton(e.target.checked)}
                className="mt-0.5"
              />
              <span>Показувати кнопку "Редагувати" для системних точок.</span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowDefaultMarkerDeleteButton}
                onChange={(e) => setAllowDefaultMarkerDeleteButton(e.target.checked)}
                className="mt-0.5"
              />
              <span>Показувати кнопку "Видалити" для системних точок.</span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowPointAdd}
                onChange={(e) => setAllowPointAdd(e.target.checked)}
                className="mt-0.5"
              />
              <span>Дозволити додавання точок.</span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowZoneAdd}
                onChange={(e) => setAllowZoneAdd(e.target.checked)}
                className="mt-0.5"
              />
              <span>Дозволити додавання зон.</span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={allowZoneEdit}
                onChange={(e) => setAllowZoneEdit(e.target.checked)}
                className="mt-0.5"
              />
              <span>Дозволити редагування зон.</span>
            </label>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {zoneModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {zoneDraftMode === 'edit' ? 'Редагувати зону' : 'Нова зона'}
              </h3>
              <button
                type="button"
                onClick={() => setZoneModalOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                ?
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300">
                Назва
                <input
                  type="text"
                  value={zoneDraftMeta.name}
                  onChange={(e) => setZoneDraftMeta((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  placeholder="Напр. Центральний ринок"
                />
              </label>
              <label className="text-xs text-slate-300">
                Колір
                <input
                  type="color"
                  value={zoneDraftMeta.color}
                  onChange={(e) => setZoneDraftMeta((prev) => ({ ...prev, color: e.target.value }))}
                  className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-300">
                Прозорість зони: {Math.round(zoneDraftMeta.opacity * 100)}%
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={zoneDraftMeta.opacity}
                  onChange={(e) => setZoneDraftMeta((prev) => ({ ...prev, opacity: Number(e.target.value) }))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 text-xs text-slate-300">
                  Точок у зоні: {zoneDraftPoints.length} (потрібно ? 4). Додаються тільки в режимі "Додати точку".
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={zoneDraftMode === 'none'}
                    onClick={() => {
                      setZonePointPickMode(true);
                      setZoneModalOpen(false);
                    }}
                    className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    Додати точку
                  </button>
                  <button
                    type="button"
                    disabled={!zoneDraftPoints.length}
                    onClick={() => setZoneDraftPoints((prev) => prev.slice(0, -1))}
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Прибрати останню
                  </button>
                  <button
                    type="button"
                    disabled={!zoneDraftPoints.length}
                    onClick={() => setZoneDraftPoints([])}
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Очистити точки
                  </button>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1 text-xs">
                  {zoneDraftPoints.map((p, idx) => (
                    <div
                      key={`zone-point-${idx}-${p.x}-${p.y}`}
                      className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200"
                    >
                      <span>
                        #{idx + 1}: {p.x}, {p.y}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setZoneDraftPoints((prev) => prev.filter((_, pointIndex) => pointIndex !== idx))
                        }
                        className="rounded border border-rose-500/50 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10"
                      >
                        Видалити
                      </button>
                    </div>
                  ))}
                  {!zoneDraftPoints.length ? (
                    <div className="text-slate-500">Ще немає вершин. Клікни по карті.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 text-xs font-medium text-slate-200">Overlay зображення зони</div>
                <label className="mb-2 block text-xs text-slate-300">
                  Завантажити картинку
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleZoneImageUpload(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                  />
                </label>
                {zoneDraftMeta.imageDataUrl ? (
                  <div className="space-y-2">
                    <img
                      src={zoneDraftMeta.imageDataUrl}
                      alt="Прев'ю overlay"
                      className="max-h-28 w-full rounded border border-slate-700 bg-slate-950 object-contain"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-300">
                        X
                        <input
                          type="number"
                          value={zoneDraftMeta.imageX ?? 0}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, imageX: Number(e.target.value) || 0 }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Y
                        <input
                          type="number"
                          value={zoneDraftMeta.imageY ?? 0}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, imageY: Number(e.target.value) || 0 }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Width
                        <input
                          type="number"
                          min={50}
                          value={zoneDraftMeta.imageWidth ?? 1500}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, imageWidth: Math.max(50, Number(e.target.value) || 1500) }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Height
                        <input
                          type="number"
                          min={50}
                          value={zoneDraftMeta.imageHeight ?? 1500}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, imageHeight: Math.max(50, Number(e.target.value) || 1500) }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                    </div>
                    <label className="block text-xs text-slate-300">
                      Прозорість: {Math.round(zoneDraftMeta.imageOpacity * 100)}%
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={zoneDraftMeta.imageOpacity}
                        onChange={(e) =>
                          setZoneDraftMeta((prev) => ({ ...prev, imageOpacity: Number(e.target.value) }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="block text-xs text-slate-300">
                      Обертання: {zoneDraftMeta.imageRotation}°
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={zoneDraftMeta.imageRotation}
                        onChange={(e) =>
                          setZoneDraftMeta((prev) => ({ ...prev, imageRotation: Number(e.target.value) }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-300">
                        Crop top %
                        <input
                          type="number"
                          min={0}
                          max={95}
                          value={zoneDraftMeta.cropTop}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, cropTop: Math.max(0, Math.min(95, Number(e.target.value) || 0)) }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Crop right %
                        <input
                          type="number"
                          min={0}
                          max={95}
                          value={zoneDraftMeta.cropRight}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, cropRight: Math.max(0, Math.min(95, Number(e.target.value) || 0)) }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Crop bottom %
                        <input
                          type="number"
                          min={0}
                          max={95}
                          value={zoneDraftMeta.cropBottom}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, cropBottom: Math.max(0, Math.min(95, Number(e.target.value) || 0)) }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Crop left %
                        <input
                          type="number"
                          min={0}
                          max={95}
                          value={zoneDraftMeta.cropLeft}
                          onChange={(e) =>
                            setZoneDraftMeta((prev) => ({ ...prev, cropLeft: Math.max(0, Math.min(95, Number(e.target.value) || 0)) }))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Можна додати оверлей і редагувати його параметри.</div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {zoneDraftMode === 'edit' && zoneDraftMeta.id ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetZone = zones.find((zone) => zone.id === zoneDraftMeta.id);
                    if (targetZone) void removeZone(targetZone);
                  }}
                  className="mr-auto rounded border border-rose-500/60 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  Видалити зону
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setZonePointPickMode(false);
                  setZoneModalOpen(false);
                }}
                className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={zoneDraftPoints.length < 4}
                onClick={() => void saveZoneFromDraft()}
                className={`rounded border px-3 py-1 text-xs ${
                  zoneDraftPoints.length >= 4
                    ? 'border-emerald-500 text-emerald-200 hover:bg-emerald-500/10'
                    : 'border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Зберегти зону
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pointEditor && !pointEditorPickMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-100">
                  {pointEditor.mode === 'create'
                    ? 'Нова точка'
                    : pointEditor.mode === 'edit-default'
                      ? 'Редагувати системну іконку'
                      : 'Редагувати точку'}
                </h3>
                {pointEditor.mode === 'edit-default' ? (
                  <span className="rounded border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                    Системна точка
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPointEditor(null);
                  setPointEditorPickMode(false);
                }}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                ?
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300">
                Назва
                <input
                  type="text"
                  value={pointEditor.title}
                  onChange={(e) => setPointEditor({ ...pointEditor, title: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-300">
                Категорія у фільтрі
                <input
                  type="text"
                  value={pointEditor.filterLabel}
                  onChange={(e) => setPointEditor({ ...pointEditor, filterLabel: e.target.value })}
                  disabled={pointEditor.mode === 'edit-default'}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Напр. Квести"
                />
              </label>
              <label className="text-xs text-slate-300">
                Зона
                <select
                  value={pointEditor.zoneId ?? ''}
                  onChange={(e) =>
                    setPointEditor({ ...pointEditor, zoneId: e.target.value || null })
                  }
                  disabled={pointEditor.mode === 'edit-default'}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Без зони</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                X
                <input
                  type="number"
                  value={pointEditor.x}
                  onChange={(e) => setPointEditor({ ...pointEditor, x: Number(e.target.value) || 0 })}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-300">
                Y
                <input
                  type="number"
                  value={pointEditor.y}
                  onChange={(e) => setPointEditor({ ...pointEditor, y: Number(e.target.value) || 0 })}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
              <span>Координати можна вибрати на карті подвійним кліком.</span>
              <button
                type="button"
                onClick={() => setPointEditorPickMode(true)}
                className="rounded border border-cyan-400/60 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-400/10"
              >
                Вибрати точку на карті (подвійний клік)
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  checked={pointEditor.iconMode === 'preset'}
                  onChange={() => setPointEditor({ ...pointEditor, iconMode: 'preset' })}
                />
                Іконка з існуючих
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  checked={pointEditor.iconMode === 'custom'}
                  onChange={() => setPointEditor({ ...pointEditor, iconMode: 'custom' })}
                />
                Власна іконка
              </label>
            </div>

            {pointEditor.iconMode === 'preset' ? (
              <div className="mt-2">
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                  <span>Обрана:</span>
                  {pointEditor.iconUrl ? (
                    <img
                      src={resolveIconSource(pointEditor.iconUrl) ?? pointEditor.iconUrl}
                      alt=""
                      className="h-5 w-5 rounded border border-slate-700 bg-slate-900 p-0.5"
                      onError={(e) => {
                        const el = e.currentTarget;
                        const fallback = getRemoteFallback(pointEditor.iconUrl);
                        if (fallback && !el.dataset.remoteTried) {
                          el.dataset.remoteTried = '1';
                          el.src = fallback;
                          return;
                        }
                        el.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-slate-500">без іконки</span>
                  )}
                </div>
                <div className="grid max-h-36 grid-cols-8 gap-1 overflow-y-auto rounded border border-slate-700 bg-slate-950 p-2">
                  <button
                    type="button"
                    onClick={() => setPointEditor({ ...pointEditor, iconUrl: null })}
                    className={`h-8 rounded border text-[10px] ${
                      !pointEditor.iconUrl
                        ? 'border-emerald-500 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    none
                  </button>
                  {allPresetIconUrls.map((iconUrl) => (
                    <button
                      key={iconUrl}
                      type="button"
                      onClick={() => setPointEditor({ ...pointEditor, iconUrl })}
                      className={`flex h-8 w-8 items-center justify-center rounded border ${
                        pointEditor.iconUrl === iconUrl
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-700 hover:bg-slate-800'
                      }`}
                      title={shortIconLabel(iconUrl)}
                    >
                      <img
                        src={resolveIconSource(iconUrl) ?? iconUrl}
                        alt={shortIconLabel(iconUrl)}
                        className="h-5 w-5 object-contain"
                        onError={(e) => {
                          const el = e.currentTarget;
                          const fallback = getRemoteFallback(iconUrl);
                          if (fallback && !el.dataset.remoteTried) {
                            el.dataset.remoteTried = '1';
                            el.src = fallback;
                            return;
                          }
                          el.style.display = 'none';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleCustomIconUpload(e.target.files?.[0] ?? null)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                />
              </div>
            )}

            <label className="mt-3 block text-xs text-slate-300">
              Картинка для підказки точки
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handlePointDetailImageUpload(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
              />
              {pointEditor.detailImageDataUrl ? (
                <div className="mt-2">
                  <img
                    src={pointEditor.detailImageDataUrl}
                    alt="Preview"
                    className="max-h-24 rounded border border-slate-700 bg-slate-950 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setPointEditor({ ...pointEditor, detailImageDataUrl: null })}
                    className="mt-1 rounded border border-rose-500/60 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
                  >
                    Прибрати картинку
                  </button>
                </div>
              ) : null}
            </label>

            <label className="mt-3 block text-xs text-slate-300">
              Опис
              <textarea
                rows={4}
                value={pointEditor.note}
                onChange={(e) => setPointEditor({ ...pointEditor, note: e.target.value })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </label>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                Колір
                <input
                  type="color"
                  value={pointEditor.color}
                  onChange={(e) => setPointEditor({ ...pointEditor, color: e.target.value })}
                  className="h-8 w-10 rounded border border-slate-700 bg-slate-950 p-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPointEditor(null);
                    setPointEditorPickMode(false);
                  }}
                  className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={() => void saveEditorPoint()}
                  className="rounded border border-emerald-500 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {pointEditor && pointEditorPickMode ? (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded border border-cyan-400/50 bg-slate-950/95 px-3 py-2 text-xs text-cyan-100 shadow-lg shadow-black/40">
          Режим вибору точки: зробіть подвійний клік по карті. Після вибору модалка відкриється знову.
        </div>
      ) : null}
    </section>
  );
}






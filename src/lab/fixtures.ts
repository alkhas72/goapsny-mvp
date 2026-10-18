// Демонстрационные места для опытного режима. Всё вымышленное: названия,
// координаты в центре Сухума и признаки не описывают реальные заведения.
// Набор покрывает состояния карточки: null и 0, unknown и no, partial,
// парковка есть, но недоступна, серое непроверенное место.
import type { LabPlace } from './contract';

const base = {
  steps_count: null,
  step_height_cm: null,
  door_width_cm: null,
  ramp_type: 'unknown',
  toilet_exists: 'unknown',
  toilet_accessible: 'unknown',
  parking: 'unknown',
  parking_accessible: 'unknown',
} satisfies Omit<LabPlace, 'id' | 'name' | 'lat' | 'lng' | 'status'>;

export const labFixtures: LabPlace[] = [
  { ...base, id: 'lab-fx-01', name: 'Демо: кафе у моря', lat: 43.0012, lng: 41.0201, status: 'green',
    steps_count: 0, door_width_cm: 95, ramp_type: 'none', toilet_exists: 'yes', toilet_accessible: 'yes', parking: 'yes', parking_accessible: 'yes' },
  { ...base, id: 'lab-fx-02', name: 'Демо: аптека на углу', lat: 43.0021, lng: 41.0163, status: 'yellow',
    steps_count: 2, step_height_cm: 12, door_width_cm: 85, ramp_type: 'portable_on_request', toilet_exists: 'no', parking: 'yes', parking_accessible: 'no' },
  { ...base, id: 'lab-fx-03', name: 'Демо: магазин во дворе', lat: 43.0034, lng: 41.0136, status: 'red',
    steps_count: 5, step_height_cm: 18, door_width_cm: 70, ramp_type: 'none', toilet_exists: 'no', parking: 'no' },
  { ...base, id: 'lab-fx-04', name: 'Демо: библиотека', lat: 43.0006, lng: 41.0171, status: 'green',
    steps_count: 3, step_height_cm: 15, door_width_cm: 110, ramp_type: 'permanent', toilet_exists: 'yes', toilet_accessible: 'partial', parking: 'unknown' },
  { ...base, id: 'lab-fx-05', name: 'Демо: поликлиника', lat: 43.0042, lng: 41.0186, status: 'yellow',
    steps_count: 1, step_height_cm: 8, door_width_cm: 100, ramp_type: 'portable_available', toilet_exists: 'yes', toilet_accessible: 'no', parking: 'yes', parking_accessible: 'yes' },
  { ...base, id: 'lab-fx-06', name: 'Демо: новая точка без данных', lat: 43.0016, lng: 41.0146, status: 'gray' },
  { ...base, id: 'lab-fx-07', name: 'Демо: школа', lat: 43.0049, lng: 41.0121, status: 'gray',
    steps_count: 4 },
  { ...base, id: 'lab-fx-08', name: 'Демо: ресторан в парке', lat: 43.0031, lng: 41.0209, status: 'yellow',
    steps_count: 1, step_height_cm: 5, door_width_cm: null, ramp_type: 'none', toilet_exists: 'yes', toilet_accessible: 'yes' },
  { ...base, id: 'lab-fx-09', name: 'Демо: гостиница', lat: 43.0002, lng: 41.0189, status: 'green',
    steps_count: 0, door_width_cm: 120, ramp_type: 'none', toilet_exists: 'yes', toilet_accessible: 'yes', parking: 'yes', parking_accessible: 'partial' },
  { ...base, id: 'lab-fx-10', name: 'Демо: музей', lat: 43.0025, lng: 41.0102, status: 'red',
    steps_count: 12, step_height_cm: 16, door_width_cm: 100, ramp_type: 'none', toilet_exists: 'unknown', parking: 'no' },
  { ...base, id: 'lab-fx-11', name: 'Демо: почта', lat: 43.0013, lng: 41.0126, status: 'gray',
    door_width_cm: 90 },
  { ...base, id: 'lab-fx-12', name: 'Демо: остановка', lat: 43.0058, lng: 41.0151, status: 'green',
    steps_count: 0, ramp_type: 'none', toilet_exists: 'no', parking: 'no' },
];

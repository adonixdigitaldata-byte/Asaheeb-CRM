export interface CityOption {
  value: string
  label: string
  group?: string
}

export const PREDEFINED_CITIES: CityOption[] = [
  // Saudi Arabia
  { value: 'Riyadh', label: 'Riyadh (الرياض)', group: 'Saudi Arabia' },
  { value: 'Jeddah', label: 'Jeddah (جدة)', group: 'Saudi Arabia' },
  { value: 'Dammam', label: 'Dammam (الدمام)', group: 'Saudi Arabia' },
  { value: 'Khobar', label: 'Al Khobar (الخبر)', group: 'Saudi Arabia' },
  { value: 'Mecca', label: 'Mecca (مكة المكرمة)', group: 'Saudi Arabia' },
  { value: 'Medina', label: 'Medina (المدينة المنورة)', group: 'Saudi Arabia' },
  { value: 'Tabuk', label: 'Tabuk (تبوك)', group: 'Saudi Arabia' },
  { value: 'Abha', label: 'Abha (أبها)', group: 'Saudi Arabia' },
  { value: 'Taif', label: 'Taif (الطائف)', group: 'Saudi Arabia' },
  { value: 'Jubail', label: 'Jubail (الجبيل)', group: 'Saudi Arabia' },
  { value: 'Al Ahsa', label: 'Al Ahsa (الأحساء)', group: 'Saudi Arabia' },
  { value: 'Yanbu', label: 'Yanbu (ينبع)', group: 'Saudi Arabia' },
  { value: 'Najran', label: 'Najran (نجران)', group: 'Saudi Arabia' },
  { value: 'Jazan', label: 'Jazan (جازان)', group: 'Saudi Arabia' },
  { value: 'Hail', label: 'Hail (حائل)', group: 'Saudi Arabia' },

  // UAE & GCC
  { value: 'Dubai', label: 'Dubai (دبي)', group: 'UAE & GCC' },
  { value: 'Abu Dhabi', label: 'Abu Dhabi (أبوظبي)', group: 'UAE & GCC' },
  { value: 'Sharjah', label: 'Sharjah (الشارقة)', group: 'UAE & GCC' },
  { value: 'Ajman', label: 'Ajman (عجمان)', group: 'UAE & GCC' },
  { value: 'Ras Al Khaimah', label: 'Ras Al Khaimah (رأس الخيمة)', group: 'UAE & GCC' },
  { value: 'Doha', label: 'Doha (الدوحة)', group: 'UAE & GCC' },
  { value: 'Manama', label: 'Manama (المنامة)', group: 'UAE & GCC' },
  { value: 'Kuwait City', label: 'Kuwait City (مدينة الكويت)', group: 'UAE & GCC' },
  { value: 'Muscat', label: 'Muscat (مسقط)', group: 'UAE & GCC' },
]

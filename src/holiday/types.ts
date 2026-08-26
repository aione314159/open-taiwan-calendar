export interface RocHolidayEntry {
  /** MM-DD */
  date: string;
  name: string;
  isHoliday: boolean;
  /** A make-up working day: worked as normal to pay back a shifted holiday */
  isMakeupWorkday: boolean;
}

export interface RocHolidayResult {
  name?: string;
  isHoliday: boolean;
  isMakeupWorkday: boolean;
}

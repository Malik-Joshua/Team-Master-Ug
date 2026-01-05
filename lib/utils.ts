import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if an activity's scheduled date/time has passed
 * @param activityDate - The scheduled date (YYYY-MM-DD format or Date object)
 * @param activityTime - Optional time (HH:MM format)
 * @returns true if the activity time has passed, false otherwise
 */
export function isActivityPast(activityDate: string | Date, activityTime?: string | null): boolean {
  const now = new Date()
  
  // Parse the activity date
  const activityDateObj = typeof activityDate === 'string' 
    ? new Date(activityDate) 
    : activityDate
  
  // If time is provided, combine date and time
  if (activityTime) {
    const [hours, minutes] = activityTime.split(':').map(Number)
    activityDateObj.setHours(hours || 0, minutes || 0, 0, 0)
  } else {
    // If no time specified, consider it past if date is before today
    // Or if date is today, consider it past at end of day (23:59:59)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const activityDay = new Date(activityDateObj)
    activityDay.setHours(0, 0, 0, 0)
    
    // If it's a past date, it's definitely past
    if (activityDay < today) {
      return true
    }
    
    // If it's today and no time specified, consider it past at end of day
    if (activityDay.getTime() === today.getTime()) {
      const endOfDay = new Date(activityDateObj)
      endOfDay.setHours(23, 59, 59, 999)
      return now > endOfDay
    }
    
    // Future date without time - not past yet
    return false
  }
  
  // Compare with current time
  return now > activityDateObj
}




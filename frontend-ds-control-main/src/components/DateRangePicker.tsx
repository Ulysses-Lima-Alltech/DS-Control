"use client"

import { format, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import { useEffect } from "react"
import { type DateRange, type DayEventHandler } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface DateParams {
    startDate: string
    endDate: string
}

interface DateRangePickerParams {
    onChange: (dateParams: DateParams | undefined) => void,
    initialValue?: DateParams
    className?: string
    placeholder?: string

}

function parseDateInput(value?: string): Date | undefined {
  if (!value) return undefined
  const datePart = value.includes("T") ? value.slice(0, 10) : value.slice(0, 10)
  const [year, month, day] = datePart.split("-")
  if (!year || !month || !day) return undefined
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  if (!Number.isInteger(yearNumber) || !Number.isInteger(monthNumber) || !Number.isInteger(dayNumber)) {
    return undefined
  }
  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber)
  if (!isValid(parsed)) return undefined
  // Strict check: avoid JS date overflow coercion (e.g. 2026-02-31 -> 2026-03-03).
  if (
    parsed.getFullYear() !== yearNumber ||
    parsed.getMonth() !== monthNumber - 1 ||
    parsed.getDate() !== dayNumber
  ) {
    return undefined
  }
  return parsed
}

function toLocalYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function safeFormatDate(date: Date | undefined, dateFormat: string) {
  if (!date || !isValid(date)) return ""
  return format(date, dateFormat, { locale: ptBR })
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && isValid(value)
}

function normalizeRange(range?: DateRange): DateRange | undefined {
  if (!range) return undefined

  const from = isValidDate(range.from) ? range.from : undefined
  const to = isValidDate(range.to) ? range.to : undefined

  if (!from) return undefined
  if (!to) return { from, to: undefined }

  return to.getTime() < from.getTime() ? { from: to, to: from } : { from, to }
}

function parseInitialRange(initialValue?: DateParams): DateRange | undefined {
  if (!initialValue) return undefined
  const from = parseDateInput(initialValue.startDate)
  const to = parseDateInput(initialValue.endDate)
  if (!from || !to) return undefined
  return normalizeRange({ from, to })
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default function DateRangePicker({
    onChange, initialValue, className, placeholder = "Selecione um intervalo de datas"
}: DateRangePickerParams) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<DateRange | undefined>(() => parseInitialRange(initialValue))
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(() => normalizeRange(date))

  const safeDate = normalizeRange(date)
  const safeDraftRange = normalizeRange(draftRange)
  const safeDefaultMonth = safeDraftRange?.from ?? safeDate?.from ?? new Date()

  const handleDayClick: DayEventHandler<React.MouseEvent> = (day) => {
    if (!isValidDate(day)) return

    const currentFrom = safeDraftRange?.from
    const currentTo = safeDraftRange?.to

    // First click: keep popover open with partial selection.
    if (!isValidDate(currentFrom) || currentTo) {
      setDraftRange({ from: day, to: undefined })
      setOpen(true)
      return
    }

    // Second click on same day: close with one-day range.
    if (sameDay(day, currentFrom)) {
      const singleDayRange: DateRange = { from: day, to: day }
      setDraftRange(singleDayRange)
      setDate(singleDayRange)
      setOpen(false)
      return
    }

    // Second click on another day: normalize order and close.
    const dayTime = day.getTime()
    const fromTime = currentFrom.getTime()
    const completeRange: DateRange =
      dayTime < fromTime ? { from: day, to: currentFrom } : { from: currentFrom, to: day }

    setDraftRange(completeRange)
    setDate(completeRange)
    setOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    const hasPartialSelection = Boolean(safeDraftRange?.from && !safeDraftRange?.to)

    // Prevent auto-close when selection is partial.
    if (!nextOpen && hasPartialSelection) {
      return
    }

    if (nextOpen) {
      setDraftRange(safeDate)
    }

    setOpen(nextOpen)
  }

  useEffect(() => {
    const nextRange = parseInitialRange(initialValue)
    if (!nextRange) return
    const nextFrom = nextRange.from
    const nextTo = nextRange.to
    if (!nextFrom || !nextTo) return
    if (safeDate?.from && safeDate?.to && sameDay(safeDate.from, nextFrom) && sameDay(safeDate.to, nextTo)) return
    setDate(nextRange)
    setDraftRange(nextRange)
  }, [initialValue?.startDate, initialValue?.endDate])

  useEffect(() => {
    if(safeDate?.from && safeDate?.to && isValid(safeDate.from) && isValid(safeDate.to)){
        onChange({
            startDate: toLocalYMD(safeDate.from),
            endDate: toLocalYMD(safeDate.to)
        })
        return
    }
    // Partial selection does not update external filters.
    if (!safeDate?.from && !safeDate?.to) {
      onChange(undefined)
    }
  }, [safeDate?.from?.getTime(), safeDate?.to?.getTime(), onChange])

  return (

    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !safeDraftRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {safeDraftRange?.from ? (
              safeDraftRange.to ? (
                <>
                  {safeFormatDate(safeDraftRange.from, "LLL dd, y")} -{" "}
                  {safeFormatDate(safeDraftRange.to, "LLL dd, y")}
                </>
              ) : (
                safeFormatDate(safeDraftRange.from, "LLL dd, y")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={safeDefaultMonth}
            selected={safeDraftRange}
            onDayClick={handleDayClick}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

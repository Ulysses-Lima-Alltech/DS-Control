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
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  return isValid(parsed) ? parsed : undefined
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
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
      if (initialValue) {
              const from = parseDateInput(initialValue.startDate)
              const to = parseDateInput(initialValue.endDate)
              if (!from || !to) {
                return undefined
              }
              return {
                  from,
                  to
              }
          }
          return undefined
      }
  )
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(date)

  const handleDayClick: DayEventHandler<React.MouseEvent> = (day) => {
    if (!isValidDate(day)) return

    const currentFrom = draftRange?.from
    const currentTo = draftRange?.to

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
    const hasPartialSelection = Boolean(draftRange?.from && !draftRange?.to)

    // Prevent auto-close when selection is partial.
    if (!nextOpen && hasPartialSelection) {
      return
    }

    if (nextOpen) {
      setDraftRange(date)
    }

    setOpen(nextOpen)
  }

  useEffect(() => {
    if (!initialValue) return

    const from = parseDateInput(initialValue.startDate)
    const to = parseDateInput(initialValue.endDate)

    if (!from || !to) return
    if (date?.from && date?.to && sameDay(date.from, from) && sameDay(date.to, to)) return

    const nextRange = { from, to }
    setDate(nextRange)
    setDraftRange(nextRange)
  }, [initialValue?.startDate, initialValue?.endDate])

  useEffect(() => {
    if(date?.from && date?.to && isValid(date.from) && isValid(date.to)){
        onChange({
            startDate: toLocalYMD(date.from),
            endDate: toLocalYMD(date.to)
        })
        return
    }
    // Partial selection does not update external filters.
    if (!date?.from && !date?.to) {
      onChange(undefined)
    }
  }, [date, onChange])

  return (

    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !draftRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {draftRange?.from ? (
              draftRange.to ? (
                <>
                  {safeFormatDate(draftRange.from, "LLL dd, y")} -{" "}
                  {safeFormatDate(draftRange.to, "LLL dd, y")}
                </>
              ) : (
                safeFormatDate(draftRange.from, "LLL dd, y")
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
            defaultMonth={draftRange?.from}
            selected={draftRange}
            onDayClick={handleDayClick}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

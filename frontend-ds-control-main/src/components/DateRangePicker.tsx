"use client"

import { format, isSameDay, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import { useEffect } from "react"
import { type DateRange } from "react-day-picker"

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
  const skipNextSelectRef = React.useRef(false)

  const handleSelect = (newDate: DateRange | undefined) => {
    if (skipNextSelectRef.current) {
      skipNextSelectRef.current = false
      return
    }

    if (newDate?.from && !newDate?.to) {
      // First click: keep popover open and store only temporary draft range.
      setDraftRange({ from: newDate.from, to: undefined })
      setOpen(true)
      return
    }

    setDraftRange(newDate)
    setDate(newDate)

    // Close only when the range is complete.
    if (newDate?.from && newDate?.to) {
      setOpen(false)
    }
  }

  const handleDayClick = (day: Date) => {
    // Double click on same day: complete as one-day range and close.
    if (draftRange?.from && !draftRange?.to && isSameDay(day, draftRange.from)) {
      const singleDayRange: DateRange = { from: day, to: day }
      skipNextSelectRef.current = true
      setDraftRange(singleDayRange)
      setDate(singleDayRange)
      setOpen(false)
    }
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
            onSelect={handleSelect}
            onDayClick={handleDayClick}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

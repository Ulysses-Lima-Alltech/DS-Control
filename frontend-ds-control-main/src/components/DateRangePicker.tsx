"use client"

import { format, isValid } from "date-fns"
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

  const handleSelect = (newDate: DateRange | undefined) => {
    if (newDate?.from && !newDate?.to) {
      // Primeiro clique: mantém aberto e guarda apenas a data inicial.
      setDate({ from: newDate.from, to: undefined })
      setOpen(true)
    } else {
      setDate(newDate)
      // Fecha apenas quando o intervalo estiver completo (inclui 1 dia: from === to).
      if (newDate?.from && newDate?.to) {
        setOpen(false)
      }
    }
  }

  useEffect(() => {
    if(date?.from && date?.to && isValid(date.from) && isValid(date.to)){
        onChange({
            startDate: toLocalYMD(date.from),
            endDate: toLocalYMD(date.to)
        })
        return
    }
    // Seleção parcial não altera filtros externos.
    if (!date?.from && !date?.to) {
      onChange(undefined)
    }
  }, [date, onChange])

  return (

    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {safeFormatDate(date.from, "LLL dd, y")} -{" "}
                  {safeFormatDate(date.to, "LLL dd, y")}
                </>
              ) : (
                safeFormatDate(date.from, "LLL dd, y")
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
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

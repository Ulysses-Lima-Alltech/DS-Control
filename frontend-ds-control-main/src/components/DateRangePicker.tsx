"use client"

import { format, isValid, parseISO } from "date-fns"
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
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function safeFormatDate(date: Date | undefined, dateFormat: string) {
  if (!date || !isValid(date)) return ""
  return format(date, dateFormat, { locale: ptBR })
}

export default function DateRangePicker({
    onChange, initialValue, className, placeholder = "Selecione um intervalo de datas"
}: DateRangePickerParams) {
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
        setDate({ from: newDate.from, to: undefined })
    } else {
        setDate(newDate)
    }
}

  useEffect(() => {
    if(date?.from && date?.to && isValid(date.from) && isValid(date.to)){
        onChange({
            startDate: format(date?.from, 'yyyy-MM-dd'),
            endDate: format(date?.to, 'yyyy-MM-dd')
        })
        return
    }
    onChange(undefined)
  }, [date, onChange])

  return (

    <div className={cn("grid gap-2", className)}>
      <Popover>
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

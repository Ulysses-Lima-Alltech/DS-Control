"use client"

import { format } from "date-fns"
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

interface DateParams {
    startDate: string
    endDate: string
}

interface DateRangePickerParams {
    onChange: (dateParams: DateParams) => void,
    initialValue?: DateParams
    className?: string
    placeholder?: string

}

export default function DateRangePicker({
    onChange, initialValue, className, placeholder = "Selecione um intervalo de datas"
}: DateRangePickerParams) {
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
      if (initialValue) {
              return {
                  from: new Date(initialValue.startDate),
                  to: new Date(initialValue.endDate)
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
    if(date?.from && date?.to){
        onChange({
            startDate: format(date?.from, 'yyyy-MM-dd'),
            endDate: format(date?.to, 'yyyy-MM-dd')
        })
    }
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
                  {format(date.from, "LLL dd, y", {locale: ptBR})} -{" "}
                  {format(date.to, "LLL dd, y", {locale: ptBR})}
                </>
              ) : (
                format(date.from, "LLL dd, y", {locale: ptBR})
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

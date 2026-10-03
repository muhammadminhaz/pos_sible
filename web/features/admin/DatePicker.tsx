"use client";

import { useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { day } from "./api";

/** A date field built from shadcn's Popover + Calendar. `value` is yyyy-mm-dd or "". */
export function DatePicker({ id, value, onChange, placeholder = "Pick a date" }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="flex-1 justify-start font-normal">
            <CalendarIcon />
            {selected ? day(selected.toISOString()) : <span className="text-muted-foreground">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              onChange(d ? d.toLocaleDateString("en-CA") : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="outline" size="icon" aria-label="Clear date" onClick={() => onChange("")}>
          <XIcon />
        </Button>
      )}
    </div>
  );
}

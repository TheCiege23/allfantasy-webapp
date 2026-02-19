'use client';
import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const commonPicks = [
  '2026 1st', '2026 2nd', '2026 3rd',
  '2027 1st', '2027 2nd',
  '2028 1st', '2028 late 1st',
];

export function PickAutocomplete({ value, onChange }: { value?: string; onChange: (pick: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(value || '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between border-cyan-800 bg-gray-950">
          {value || 'Select draft pick...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="2026 1st..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matching picks.</CommandEmpty>
            <CommandGroup>
              {commonPicks
                .filter(p => p.toLowerCase().includes(search.toLowerCase()))
                .map(pick => (
                  <CommandItem
                    key={pick}
                    onSelect={() => {
                      onChange(pick);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === pick ? 'opacity-100' : 'opacity-0')} />
                    {pick}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

'use client';
import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type Player = {
  id: string;
  name: string;
  position: string;
  team: string | null;
};

interface PlayerAutocompleteProps {
  value?: Player | null;
  onChange: (player: Player | null) => void;
  placeholder?: string;
}

export function PlayerAutocomplete({
  value,
  onChange,
  placeholder = 'Search players...',
}: PlayerAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [options, setOptions] = React.useState<Player[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (search.length < 2) {
      setOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setOptions(data);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-cyan-800 bg-gray-950 text-left"
        >
          {value ? `${value.name} (${value.position}${value.team ? ` - ${value.team}` : ''})` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-gray-950 border-cyan-800">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type player name..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Searching...' : 'No players found.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map((player) => (
                <CommandItem
                  key={player.id}
                  value={player.id}
                  onSelect={() => {
                    onChange(player);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.id === player.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {player.name} ({player.position})
                  {player.team && ` - ${player.team}`}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

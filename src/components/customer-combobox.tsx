'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { searchCustomersAction, type CustomerSearchResult } from '@/lib/actions'

interface CustomerComboboxProps {
  value?: string | null
  onValueChange: (customerId: string | null, customer: CustomerSearchResult | null) => void
  placeholder?: string
  disabled?: boolean
  initialCustomer?: { id: string; name: string } | null
}

export function CustomerCombobox({
  value,
  onValueChange,
  placeholder = 'Select customer...',
  disabled = false,
  initialCustomer = null,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(
    initialCustomer ? {
      id: initialCustomer.id,
      name: initialCustomer.name,
      customer_code: '',
    } as CustomerSearchResult : null
  )

  // Update selected customer when value changes externally
  useEffect(() => {
    if (!value && selectedCustomer) {
      setSelectedCustomer(null)
    }
  }, [value, selectedCustomer])

  // Search customers when query changes
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCustomers([])
      return
    }

    setIsLoading(true)
    try {
      const results = await searchCustomersAction(query)
      setCustomers(results)
    } catch (error) {
      console.error('Customer search error:', error)
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchCustomers(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchCustomers])

  const handleSelect = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer)
    onValueChange(customer.id, customer)
    setOpen(false)
    setSearchQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCustomer(null)
    onValueChange(null, null)
    setSearchQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedCustomer ? (
            <span className="truncate">
              {selectedCustomer.name}
              {selectedCustomer.city && (
                <span className="text-muted-foreground ml-1">
                  ({selectedCustomer.city})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selectedCustomer && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customers..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : customers.length === 0 ? (
              <CommandEmpty>No customers found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelect(customer)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === customer.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {customer.customer_code}
                        {customer.city && ` • ${customer.city}`}
                        {customer.email && ` • ${customer.email}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

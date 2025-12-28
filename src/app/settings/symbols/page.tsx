'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import { getSymbolRulesAction, SymbolRule } from '@/lib/actions/symbols'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fossapp/ui'

function formatIpRange(ip_min: number | null, ip_max: number | null): string {
  if (ip_min !== null && ip_max !== null) return `${ip_min}-${ip_max}`
  if (ip_min !== null) return `IP ${ip_min}+`
  if (ip_max !== null) return `IP <${ip_max}`
  return '-'
}

export default function SymbolsSettingsPage() {
  const { status } = useDevSession()
  const [rules, setRules] = useState<SymbolRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getSymbolRulesAction()
      setRules(data)
    } catch (error) {
      console.error('Failed to load symbol rules:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      loadRules()
    }
  }, [status, loadRules])

  if (status === 'loading' || isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>FOSS Symbol Classification Rules</CardTitle>
        <CardDescription>
          Symbols are assigned to products based on ETIM class and IP rating for use in lighting design drawings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>ETIM Class</TableHead>
              <TableHead className="w-28">IP Range</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <Badge variant="default" className="text-lg font-bold px-3">
                    {rule.symbol}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-xs">{rule.etim_class}</span>
                  {rule.etim_class_desc && (
                    <span className="ml-2">{rule.etim_class_desc}</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatIpRange(rule.ip_min, rule.ip_max)}
                </TableCell>
                <TableCell>
                  <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                  {rule.notes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rules.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No symbol rules found.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

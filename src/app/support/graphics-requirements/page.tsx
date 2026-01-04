/**
 * Graphics Requirements Support Page
 *
 * Displays WebGL troubleshooting information for users whose browsers
 * don't support the viewer's 3D/2D rendering requirements.
 */

import { AlertTriangle, CheckCircle2, ExternalLink, Monitor, Chrome, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@fossapp/ui'
import Link from 'next/link'

export default function GraphicsRequirementsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-12 px-4">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <Monitor className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-3xl font-bold mb-2">Graphics Requirements</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              The FOSSAPP viewer requires WebGL to display 2D and 3D drawings.
              Follow the steps below to troubleshoot graphics issues.
            </p>
          </div>

          {/* WebGL Check */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Check WebGL Support
              </CardTitle>
              <CardDescription>
                Visit the link below to check if your browser supports WebGL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <a
                  href="https://get.webgl.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Check WebGL Support
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Common Solutions */}
          <Card>
            <CardHeader>
              <CardTitle>Common Solutions</CardTitle>
              <CardDescription>
                Try these steps to enable WebGL in your browser
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Update Browser */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Chrome className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Update Your Browser</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Ensure you&apos;re using the latest version of Chrome, Firefox, Edge, or Safari.
                    Older browsers may have limited or no WebGL support.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Chrome 90+ (recommended)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Firefox 88+
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Edge 90+
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Safari 15+
                    </li>
                  </ul>
                </div>
              </div>

              {/* Hardware Acceleration */}
              <div className="flex gap-4 pt-4 border-t">
                <div className="flex-shrink-0 mt-1">
                  <Monitor className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Enable Hardware Acceleration</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    WebGL requires hardware acceleration to be enabled in your browser settings.
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                    <div>
                      <span className="font-medium">Chrome:</span>{' '}
                      <span className="text-muted-foreground">
                        Settings &rarr; System &rarr; Enable &quot;Use hardware acceleration when available&quot;
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Firefox:</span>{' '}
                      <span className="text-muted-foreground">
                        Settings &rarr; General &rarr; Performance &rarr; Enable &quot;Use hardware acceleration&quot;
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Edge:</span>{' '}
                      <span className="text-muted-foreground">
                        Settings &rarr; System &rarr; Enable &quot;Use hardware acceleration when available&quot;
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphics Drivers */}
              <div className="flex gap-4 pt-4 border-t">
                <div className="flex-shrink-0 mt-1">
                  <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Update Graphics Drivers</h3>
                  <p className="text-sm text-muted-foreground">
                    Outdated or missing graphics drivers can prevent WebGL from working.
                    Visit your graphics card manufacturer&apos;s website to download the latest drivers:
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>
                      <a
                        href="https://www.nvidia.com/Download/index.aspx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        NVIDIA Drivers
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.amd.com/en/support"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        AMD Drivers
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.intel.com/content/www/us/en/download-center/home.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Intel Drivers
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Still need help */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Still having issues? Contact support at{' '}
                <a href="mailto:development@fossapp.gr" className="text-primary hover:underline">
                  development@fossapp.gr
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

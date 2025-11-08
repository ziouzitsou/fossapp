'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const images = [
  { src: '/login/login-01-ceiling.jpg', alt: 'Architectural ceiling lighting installation' },
  { src: '/login/login-02-pendants.jpg', alt: 'Designer pendant light fixtures' },
  { src: '/login/login-03-connectors.jpg', alt: 'Premium lighting connectors and cables' },
  { src: '/login/login-04-downlight.jpg', alt: 'Recessed downlight fixture' },
]

export function LoginImageSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
        setIsTransitioning(false)
      }, 500) // Half of transition duration
    }, 6000) // Change image every 6 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {images.map((image, index) => (
        <div
          key={image.src}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentIndex && !isTransitioning
              ? 'opacity-100'
              : 'opacity-0'
          }`}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover dark:brightness-[0.2] dark:grayscale"
            priority={index === 0}
            quality={85}
          />
        </div>
      ))}
    </div>
  )
}

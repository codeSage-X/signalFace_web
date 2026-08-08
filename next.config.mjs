/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Firebase's `signInWithPopup` polls `popup.closed` to notice when the
        // user dismisses the Google window. Under `Cross-Origin-Opener-Policy:
        // same-origin` the browser severs the opener/popup link and that read is
        // blocked, which is what produces the repeated "would block the
        // window.closed call" console warnings. `same-origin-allow-popups` keeps
        // us isolated from windows that open *us* while still letting us hold a
        // handle on popups *we* open, so the poll works again.
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
}

export default nextConfig

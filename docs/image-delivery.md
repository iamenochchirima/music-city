# Image delivery

Uploaded release covers, track artwork and profile photos use stable, signed image URLs. The URL binds the upload's immutable storage key and the image pipeline version. Replacing an image creates a new upload key and URL. The original is preserved.

The image service generates WebP widths of 96, 192, 384, 768, 1200 and 1600 pixels without enlargement. It applies EXIF orientation and strips metadata. Variants persist in `image-variants/v1/` in the configured storage. Processing is limited to two images at a time, 20 MiB of compressed input and 40 million decoded pixels. Audio keys, unsigned inputs, arbitrary remote URLs and path traversal are rejected.

The client requests only the sizes appropriate to each display slot through a shared image component. Visible hero artwork has high priority; other images use native lazy loading and asynchronous decoding. Existing bundled raster assets get responsive WebP variants during the client build, and Vite gives those assets content-hashed URLs. SVGs and local upload previews retain their original resource types.

Vercel rewrites `/media/images/` to the API image route and caches successful responses for one year. The API also returns browser cache headers, strong ETags and image cache tags. Error responses are not marked cacheable. Original uploads use unique keys; do not overwrite an existing upload key. To revoke a previously shared image before cache expiry, purge its `image-<sha256-of-storage-key>` CDN tag and remove the stored original and variants.

No database migration or new environment variable is required. Deploy the client rewrite first, then the API, so the CDN route exists before the API starts returning its image URLs. `CLIENT_ORIGIN` must be the canonical client origin. The Vite development proxy forwards `/media/images/` to the configured local API.

After deployment, run `node dist/scripts/warm-images.js` in the API service to prepare every existing stored cover and profile image. The script is repeatable and preserves existing artwork, users, releases and audio. It reports counts and failures without printing credentials or signed URLs. Verify public artwork at 384 and 768 pixels, compare bytes with the original and confirm a repeated request returns a CDN HIT.

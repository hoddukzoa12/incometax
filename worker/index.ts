const NO_CONTENT_STATUS = 204

export default {
  fetch(): Response {
    return new Response(null, { status: NO_CONTENT_STATUS })
  },
} satisfies ExportedHandler


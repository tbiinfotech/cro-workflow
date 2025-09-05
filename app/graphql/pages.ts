export const GET_PAGE_BY_HANDLE = `
  query($handle: String!) {
  pageByHandle(handle: $handle) {
    id
    title
    body
    handle
    url
  }
}`;



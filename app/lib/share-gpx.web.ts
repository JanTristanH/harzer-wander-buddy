export async function shareGpx(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/gpx+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Firefox needs time to consume the object URL after click.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

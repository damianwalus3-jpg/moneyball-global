/** Resolve a FootyNomad fixture's country heading and league group without
 * ever inheriting the previous country's last league group.
 */
export function footyNomadSectionAt(html: string, matchIndex: number) {
  const countryStart = html.lastIndexOf('<h2 class="section-title', matchIndex);
  const countryEnd = countryStart >= 0 ? html.indexOf("</h2>", countryStart) : -1;
  const groupStart = html.lastIndexOf('<details class="league-group', matchIndex);
  const summaryEnd = groupStart >= 0 ? html.indexOf("</summary>", groupStart) : -1;

  const countryHtml = countryStart >= 0 && countryEnd > countryStart
    ? html.slice(countryStart, countryEnd)
    : "";
  const summaryHtml = countryStart >= 0 && groupStart > countryStart && summaryEnd > groupStart
    ? html.slice(groupStart, summaryEnd)
    : "";

  return { countryHtml, summaryHtml };
}

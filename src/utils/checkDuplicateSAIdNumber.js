// Utility to check for duplicate SA ID numbers in DHIS2
const apiBaseUrl = "https://staging.dhis.dhmis.org/za-eidsr";

export const checkDuplicateSAIdNumber = async (idNumber, baseUrl = apiBaseUrl) => {
  const url = `${baseUrl}/api/41/tracker/trackedEntities?program=ogrOUKoSaWA&orgUnitMode=ACCESSIBLE&filter=iS1g0uT0Dsb:EQ:${idNumber}`;
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return false;
    const data = await response.json();
    return data.trackedEntities && data.trackedEntities.length > 0;
  } catch (e) {
    // On error, assume not duplicate (fail open, but could log)
    return false;
  }
}; 
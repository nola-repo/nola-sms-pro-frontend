import { useEffect, useState } from 'react';
import { getAccountSettings, saveAccountSettings } from '../utils/settingsStorage';

export function useGhlLocation() {
    const [locationId, setLocationId] = useState<string | null>(getAccountSettings().ghlLocationId || null);

    useEffect(() => {
        // Parse URL parameters
        const params = new URLSearchParams(window.location.search);
        // GoHighLevel passes 'location' parameter for custom menu links
        const urlLocation = params.get('location') || params.get('locationId');

        if (urlLocation && urlLocation !== locationId) {
            setLocationId(urlLocation);

            // Auto-save to local storage if it's different from what we had
            const accountSettings = getAccountSettings();
            if (accountSettings.ghlLocationId !== urlLocation) {
                saveAccountSettings({
                    ...accountSettings,
                    ghlLocationId: urlLocation,
                });
            }
        }
    }, [locationId]);

    return locationId;
}

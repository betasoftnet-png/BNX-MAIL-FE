import { useTranslation } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MapPin, Sun, Moon, Wind, Droplets, Loader2, AlertCircle, CloudSun, Sunrise, Sunset, Thermometer } from 'lucide-react';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1
        }
    }
});

const fetchWeather = async (lat, lon) => {
    // using .env for api bases if available with safe fallback
    const baseUrl = import.meta.env.VITE_OPEN_METEO_API || 'https://api.open-meteo.com/v1/forecast';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&hourly=temperature_2m&current=temperature_2m,is_day,relative_humidity_2m,wind_speed_10m&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch weather data');
    }
    return response.json();
};

const fetchLocationName = async (lat, lon) => {
    const baseUrl = import.meta.env.VITE_BIGDATA_CLOUD_API || 'https://api.bigdatacloud.net/data/reverse-geocode-client';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch location name');
    }
    return response.json();
};

const WeatherPanelInner = () => {
  const { t } = useTranslation();
    const [location, setLocation] = useState(null);
    const [geoError, setGeoError] = useState(null);
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);

    const requestLocation = () => {
        setIsRequestingLocation(true);
        setGeoError(null);

        if (!navigator.geolocation) {
            setGeoError("Geolocation is not supported by your browser.");
            setIsRequestingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
                setIsRequestingLocation(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                setGeoError("Location access denied or unavailable. Please enable location permissions.");
                setIsRequestingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const { 
        data: weatherData, 
        isLoading: isWeatherLoading, 
        isError: isWeatherError 
    } = useQuery({
        queryKey: ['weather', location?.lat, location?.lon],
        queryFn: () => fetchWeather(location.lat, location.lon),
        enabled: !!location, // Only fetch if location is available
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const { 
        data: locationData, 
        isLoading: isLocationLoading 
    } = useQuery({
        queryKey: ['locationName', location?.lat, location?.lon],
        queryFn: () => fetchLocationName(location.lat, location.lon),
        enabled: !!location,
        staleTime: 60 * 60 * 1000, // 1 hour
    });

    if (!location && !isRequestingLocation && !geoError) {
        return (
            <div className="flex flex-col min-h-[400px] h-full w-full bg-white items-center justify-center p-6 text-center rounded-xl border border-gray-100 shadow-sm">
                <CloudSun size={48} className="text-cyan-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Local Weather</h3>
                <p className="text-sm text-gray-500 mb-6">Allow location access to see the current weather in your area.</p>
                <button 
                    onClick={requestLocation}
                    className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm cursor-pointer active:scale-95"
                >
                    <MapPin size={18} />
                    Detect Location
                </button>
            </div>
        );
    }

    if (isRequestingLocation || (location && (isWeatherLoading || isLocationLoading))) {
        return (
            <div className="flex flex-col min-h-[400px] h-full w-full bg-white items-center justify-center p-6 text-gray-500 rounded-xl border border-gray-100 shadow-sm">
                <Loader2 className="animate-spin text-cyan-500 mb-4" size={32} />
                <p className="text-sm text-center">
                    {isRequestingLocation ? "Detecting location..." : "Fetching local weather..."}
                </p>
            </div>
        );
    }

    if (geoError) {
        return (
            <div className="flex flex-col min-h-[400px] h-full w-full bg-white items-center justify-center p-6 text-red-500 text-center rounded-xl border border-gray-100 shadow-sm">
                <AlertCircle size={32} className="mb-4 text-red-400" />
                <p className="text-sm font-medium mb-2">Location Error</p>
                <p className="text-xs text-red-400">{geoError}</p>
            </div>
        );
    }

    if (isWeatherError) {
        return (
            <div className="flex flex-col min-h-[400px] h-full w-full bg-white items-center justify-center p-6 text-red-500 text-center rounded-xl border border-gray-100 shadow-sm">
                <AlertCircle size={32} className="mb-4 text-red-400" />
                <p className="text-sm font-medium mb-2">Weather Error</p>
                <p className="text-xs text-red-400">Failed to load weather data.</p>
            </div>
        );
    }

    const current = weatherData?.current;
    const daily = weatherData?.daily;
    const isDay = current?.is_day === 1;
    const cityName = locationData?.city || locationData?.locality || "Current Location";

    const maxTemp = daily?.temperature_2m_max?.[0];
    const minTemp = daily?.temperature_2m_min?.[0];
    const sunriseTime = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    const sunsetTime = daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

    return (
        <div className="flex flex-col min-h-[400px] h-full w-full bg-gradient-to-b from-cyan-50 to-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            {/* Header / Location */}
            <div className="flex items-center gap-2 p-5 border-b border-cyan-100/50 bg-white/50 backdrop-blur-sm shrink-0">
                <MapPin size={18} className="text-cyan-500 shrink-0" />
                <h2 className="text-gray-800 font-semibold truncate text-sm">
                    {cityName}
                </h2>
            </div>

            {/* Main Weather Info */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-6">
                    <div className="absolute inset-0 blur-2xl opacity-40 bg-cyan-400 rounded-full"></div>
                    {isDay ? (
                        <Sun size={80} className="text-amber-400 drop-shadow-md relative z-10" fill="currentColor" />
                    ) : (
                        <Moon size={80} className="text-cyan-300 drop-shadow-md relative z-10" fill="currentColor" />
                    )}
                </div>
                
                <div className="flex items-start justify-center">
                    <span className="text-6xl font-black text-gray-800 tracking-tighter">
                        {Math.round(current?.temperature_2m)}
                    </span>
                    <span className="text-2xl font-bold text-gray-400 mt-2">°</span>
                </div>
                <p className="text-gray-500 text-sm font-medium mt-1">
                    {isDay ? "Sunny" : "Clear Night"}
                </p>
            </div>

            {/* Details Grid */}
            <div className="p-5 grid grid-cols-2 gap-3 bg-white/60 border-t border-cyan-100/50 shrink-0">
                <div className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Wind size={20} className="text-cyan-400 mb-1" />
                    <span className="text-xs text-gray-400 font-medium mb-1">Wind</span>
                    <span className="text-sm font-bold text-gray-700">
                        {current?.wind_speed_10m} <span className="text-xs font-normal">km/h</span>
                    </span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Droplets size={20} className="text-cyan-400 mb-1" />
                    <span className="text-xs text-gray-400 font-medium mb-1">Humidity</span>
                    <span className="text-sm font-bold text-gray-700">
                        {current?.relative_humidity_2m}%
                    </span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Thermometer size={20} className="text-cyan-400 mb-1" />
                    <span className="text-xs text-gray-400 font-medium mb-1">High / Low</span>
                    <span className="text-sm font-bold text-gray-700">
                        {Math.round(maxTemp)}° / {Math.round(minTemp)}°
                    </span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                    {isDay ? <Sunset size={20} className="text-cyan-400 mb-1" /> : <Sunrise size={20} className="text-cyan-400 mb-1" />}
                    <span className="text-xs text-gray-400 font-medium mb-1">{isDay ? "Sunset" : "Sunrise"}</span>
                    <span className="text-sm font-bold text-gray-700">
                        {isDay ? sunsetTime : sunriseTime}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default function WeatherPanel() {
    return (
        <QueryClientProvider client={queryClient}>
            <WeatherPanelInner />
        </QueryClientProvider>
    );
}

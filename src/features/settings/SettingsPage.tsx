import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
  const { accessToken, refreshToken, userId, userEmail } = useAuthStore();
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(soundEnabled));
  }, [soundEnabled]);

  const { data: liveStatus, isLoading: isLiveLoading } = useQuery({
    queryKey: ['health', 'live'],
    queryFn: healthApi.getLive,
  });

  const { data: readyStatus, isLoading: isReadyLoading } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: healthApi.getReady,
  });

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/chat')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Chat
        </Button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Settings & Debug</h1>

      <div className="grid gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="font-medium">Sound Notifications</span>
              <Button 
                variant={soundEnabled ? "default" : "outline"}
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="w-20"
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Play a sound when a new message is received.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Live Status:</span>
              <span className={isLiveLoading ? 'text-muted-foreground' : 'text-green-600'}>
                {isLiveLoading ? 'Loading...' : JSON.stringify(liveStatus?.data)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Ready Status:</span>
              <span className={isReadyLoading ? 'text-muted-foreground' : 'text-green-600'}>
                {isReadyLoading ? 'Loading...' : JSON.stringify(readyStatus?.data)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <span className="font-medium">User ID:</span>
              <span className="font-mono truncate">{userId}</span>
              
              <span className="font-medium">Email:</span>
              <span className="font-mono truncate">{userEmail}</span>
              
              <span className="font-medium">Access Token:</span>
              <span className="font-mono truncate text-muted-foreground" title={accessToken || ''}>
                {accessToken ? `${accessToken.substring(0, 20)}...` : 'None'}
              </span>
              
              <span className="font-medium">Refresh Token:</span>
              <span className="font-mono truncate text-muted-foreground" title={refreshToken || ''}>
                {refreshToken ? `${refreshToken.substring(0, 20)}...` : 'None'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

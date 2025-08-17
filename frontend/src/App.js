import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { CalendarIcon, Users, Trophy, Clock, Plus, LogOut, User, Home } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setUser(userData);
    return userData;
  };

  const register = async (email, name, password, role) => {
    const response = await axios.post(`${API}/auth/register`, {
      email, name, password, role
    });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// Navigation Component
const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              HackCraft
            </h1>
            <div className="ml-8 flex space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/events')}
                className="flex items-center gap-2"
              >
                <CalendarIcon className="w-4 h-4" />
                Events
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
            <span className="text-sm text-gray-700">{user.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Auth Pages
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('participant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        await register(email, name, password, role);
        setIsLogin(true);
        setError('');
        setEmail('');
        setPassword('');
        setName('');
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            HackCraft
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">Participant</SelectItem>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="judge">Judge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
            
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Dashboard Pages
const OrganizerDashboard = () => {
  const [events, setEvents] = useState([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    submission_deadline: '',
    max_team_size: 4,
    tracks: '',
    prizes: '',
    rules: ''
  });

  useEffect(() => {
    fetchMyEvents();
  }, []);

  const fetchMyEvents = async () => {
    try {
      const response = await axios.get(`${API}/events/my/organized`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const eventData = {
        ...eventForm,
        tracks: eventForm.tracks.split(',').map(t => t.trim()).filter(t => t),
        prizes: eventForm.prizes.split(',').map(p => p.trim()).filter(p => p),
        start_date: new Date(eventForm.start_date).toISOString(),
        end_date: new Date(eventForm.end_date).toISOString(),
        submission_deadline: new Date(eventForm.submission_deadline).toISOString(),
      };
      
      await axios.post(`${API}/events`, eventData);
      setShowCreateEvent(false);
      setEventForm({
        title: '', description: '', start_date: '', end_date: '', submission_deadline: '',
        max_team_size: 4, tracks: '', prizes: '', rules: ''
      });
      fetchMyEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const updateEventStatus = async (eventId, status) => {
    try {
      await axios.put(`${API}/events/${eventId}/status?status=${status}`);
      fetchMyEvents();
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  if (showCreateEvent) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Create New Event</CardTitle>
            <CardDescription>Set up your hackathon or competition</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_team_size">Max Team Size</Label>
                  <Input
                    id="max_team_size"
                    type="number"
                    value={eventForm.max_team_size}
                    onChange={(e) => setEventForm({...eventForm, max_team_size: parseInt(e.target.value)})}
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm({...eventForm, start_date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm({...eventForm, end_date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submission_deadline">Submission Deadline</Label>
                  <Input
                    id="submission_deadline"
                    type="datetime-local"
                    value={eventForm.submission_deadline}
                    onChange={(e) => setEventForm({...eventForm, submission_deadline: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tracks">Tracks (comma-separated)</Label>
                  <Input
                    id="tracks"
                    value={eventForm.tracks}
                    onChange={(e) => setEventForm({...eventForm, tracks: e.target.value})}
                    placeholder="Web Development, Mobile Apps, AI/ML"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prizes">Prizes (comma-separated)</Label>
                  <Input
                    id="prizes"
                    value={eventForm.prizes}
                    onChange={(e) => setEventForm({...eventForm, prizes: e.target.value})}
                    placeholder="$5000 First Prize, $3000 Second Prize"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rules">Rules and Guidelines</Label>
                <Textarea
                  id="rules"
                  value={eventForm.rules}
                  onChange={(e) => setEventForm({...eventForm, rules: e.target.value})}
                  rows={4}
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit">Create Event</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateEvent(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Organizer Dashboard</h1>
        <Button onClick={() => setShowCreateEvent(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Event
        </Button>
      </div>
      
      <div className="grid gap-6">
        {events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No events yet</h3>
              <p className="text-gray-500 mb-4">Create your first hackathon event</p>
              <Button onClick={() => setShowCreateEvent(true)}>
                Create Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{event.title}</CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </div>
                  <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                    {event.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <strong>Start:</strong><br />
                    {new Date(event.start_date).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>End:</strong><br />
                    {new Date(event.end_date).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Submission Deadline:</strong><br />
                    {new Date(event.submission_deadline).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Max Team Size:</strong><br />
                    {event.max_team_size}
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  {event.status === 'draft' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateEventStatus(event.id, 'active')}
                    >
                      Publish Event
                    </Button>
                  )}
                  {event.status === 'active' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateEventStatus(event.id, 'submissions_open')}
                    >
                      Open Submissions
                    </Button>
                  )}
                  {event.status === 'submissions_open' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateEventStatus(event.id, 'submissions_closed')}
                    >
                      Close Submissions
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const ParticipantDashboard = () => {
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', event_id: '' });

  useEffect(() => {
    fetchMyTeams();
    fetchEvents();
  }, []);

  const fetchMyTeams = async () => {
    try {
      const response = await axios.get(`${API}/teams/my`);
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/events`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/teams`, teamForm);
      setShowCreateTeam(false);
      setTeamForm({ name: '', event_id: '' });
      fetchMyTeams();
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Participant Dashboard</h1>
        <Button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Create Team
        </Button>
      </div>

      {showCreateTeam && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Team</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team_name">Team Name</Label>
                <Input
                  id="team_name"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({...teamForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event">Select Event</Label>
                <Select value={teamForm.event_id} onValueChange={(value) => setTeamForm({...teamForm, event_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.filter(e => e.status === 'active').map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create Team</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateTeam(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Teams</CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-gray-500">No teams yet. Create or join a team to get started!</p>
            ) : (
              <div className="space-y-4">
                {teams.map((team) => (
                  <div key={team.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="text-sm text-gray-600">Members: {team.members.length}</p>
                    <Badge variant="secondary" className="mt-2">
                      Event ID: {team.event_id}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {events.filter(e => e.status === 'active').map((event) => (
                <div key={event.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Max Team Size: {event.max_team_size}</span>
                    <span>Deadline: {new Date(event.submission_deadline).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const JudgeDashboard = () => {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Judge Dashboard</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No assignments yet</h3>
          <p className="text-gray-500">You'll see evaluation tasks when organizers assign you to events.</p>
        </CardContent>
      </Card>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'organizer':
      return <OrganizerDashboard />;
    case 'participant':
      return <ParticipantDashboard />;
    case 'judge':
      return <JudgeDashboard />;
    default:
      return <div>Unknown role</div>;
  }
};

const EventsPage = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/events`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">All Events</h1>
      <div className="grid gap-6">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{event.title}</CardTitle>
                  <CardDescription>{event.description}</CardDescription>
                </div>
                <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                  {event.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <strong>Start:</strong><br />
                  {new Date(event.start_date).toLocaleDateString()}
                </div>
                <div>
                  <strong>End:</strong><br />
                  {new Date(event.end_date).toLocaleDateString()}
                </div>
                <div>
                  <strong>Submission Deadline:</strong><br />
                  {new Date(event.submission_deadline).toLocaleDateString()}
                </div>
                <div>
                  <strong>Max Team Size:</strong><br />
                  {event.max_team_size}
                </div>
              </div>
              
              {event.tracks.length > 0 && (
                <div className="mt-4">
                  <strong className="text-sm">Tracks:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {event.tracks.map((track, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {track}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {event.prizes.length > 0 && (
                <div className="mt-3">
                  <strong className="text-sm">Prizes:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {event.prizes.map((prize, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {prize}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/auth" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/events" element={<EventsPage />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
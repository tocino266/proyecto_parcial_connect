// supabase-config.js
const supabaseUrl = 'https://ercqnkfvjaqlxevzfaok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyY3Fua2Z2amFxbHhldnpmYW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDc2OTAsImV4cCI6MjA5NjYyMzY5MH0.SLE60lpRyqJiegjCrZzn510epKCkNILgefWBloyQYBk';

// Cambiamos el nombre a "clienteSupabase" para que no choque con la librería del CDN
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Conexión a Supabase inicializada correctamente.");
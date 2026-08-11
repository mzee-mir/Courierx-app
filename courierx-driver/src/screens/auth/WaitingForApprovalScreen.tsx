import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Clock, LogOut, RefreshCcw } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

export const WaitingForApprovalScreen = () => {
  const { driver, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Clock size={48} color="#2563EB" />
        </View>
        
        <Text style={styles.title}>Registration Received</Text>
        <Text style={styles.subtitle}>
          Hi {driver?.displayName || 'Driver'}, your account is currently being reviewed by the CourierX Admin team.
        </Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Approval typically takes 24-48 hours. We will notify you once you can start accepting jobs.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.refreshBtn}
          onPress={() => {/* In Step 15.1, the Context automatically re-checks on app focus */}}
        >
          <RefreshCcw size={20} color="#2563EB" />
          <Text style={styles.refreshText}>Check Status</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <LogOut size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Use different account</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 30,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  infoText: {
    color: '#374151',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    padding: 10,
  },
  refreshText: {
    marginLeft: 10,
    color: '#2563EB',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoutText: {
    color: '#e05353ff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
// Stage 0 — Create Account. No real auth in this prototype: the name is kept so
// Home can greet you, then first sign-up continues to the household questions.

import React, { useState } from 'react';
import { Image, Text } from 'react-native';

import { AuthShell, authStyles } from '../components/AuthShell';
import { Field, PrimaryButton } from '../components/kit';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function CreateAccountScreen({ navigation }: ScreenProps<'CreateAccount'>) {
  const setProfile = useSession((s) => s.setProfile);
  const onboarded = useSession((s) => s.onboarded);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const signUp = () => {
    setProfile({ name: name.trim() || 'Friend', email: email.trim() });
    if (onboarded) navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    else navigation.reset({ index: 0, routes: [{ name: 'Household', params: { onboarding: true } }] });
  };

  return (
    <AuthShell
      title="Create Account"
      footer={{ text: 'Already have an account?', link: 'Log In', onPress: () => navigation.navigate('Login') }}
    >
      <Image source={IMAGES.avatar} style={authStyles.avatar} resizeMode="contain" />
      <Field labelStyle={authStyles.label} inputStyle={authStyles.input} label="First Name/Username" value={name} onChangeText={setName} autoCapitalize="words" style={authStyles.field} />
      <Field labelStyle={authStyles.label} inputStyle={authStyles.input} label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={authStyles.field} />
      <Field labelStyle={authStyles.label} inputStyle={authStyles.input} label="Password (min. 6 characters)" value={password} onChangeText={setPassword} secureTextEntry style={authStyles.field} />
      <Field labelStyle={authStyles.label} inputStyle={authStyles.input} label="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry style={authStyles.field} />
      <PrimaryButton label="Sign Up" onPress={signUp} style={authStyles.submit} textStyle={authStyles.submitTxt} />
      <Text style={authStyles.note}>By signing up, you agree to our Terms & Privacy Policy</Text>
    </AuthShell>
  );
}

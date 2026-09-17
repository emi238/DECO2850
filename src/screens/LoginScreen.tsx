// Stage 0 — Log In. Same look as Create Account. No real auth yet: any input
// continues (first login → household questions, otherwise → Home).

import React, { useState } from 'react';
import { Image, Text, Pressable } from 'react-native';

import { AuthShell, authStyles } from '../components/AuthShell';
import { Field, PrimaryButton } from '../components/kit';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const setProfile = useSession((s) => s.setProfile);
  const onboarded = useSession((s) => s.onboarded);
  const profile = useSession((s) => s.profile);

  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');

  const logIn = () => {
    const e = email.trim();
    setProfile({ email: e, name: profile.name || (e ? capitalise(e.split('@')[0]) : 'Friend') });
    if (onboarded) navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    else navigation.reset({ index: 0, routes: [{ name: 'Household', params: { onboarding: true } }] });
  };

  return (
    <AuthShell
      title="Log In"
      footer={{ text: "Don't have an account?", link: 'Sign Up', onPress: () => navigation.navigate('CreateAccount') }}
    >
      <Image source={IMAGES.avatar} style={authStyles.avatar} resizeMode="contain" />
      <Field labelStyle={authStyles.label} inputStyle={authStyles.input} label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={authStyles.field} />
      <Field labelStyle={authStyles.label} inputStyle={authStyles.input} label="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 12 }} />
      <Pressable onPress={() => navigation.navigate('ResetPassword')} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
        <Text style={authStyles.forgot}>Forgot password?</Text>
      </Pressable>
      <PrimaryButton label="Log In" onPress={logIn} style={authStyles.submit} textStyle={authStyles.submitTxt} />
    </AuthShell>
  );
}

const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

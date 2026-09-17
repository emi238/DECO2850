// Stage 0 — Reset Password. Placeholder (no auth backend yet): the button just
// returns to Log In.

import React, { useState } from 'react';

import { AuthShell, authStyles } from '../components/AuthShell';
import { Field, PrimaryButton } from '../components/kit';
import { colors } from '../theme';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function ResetPasswordScreen({ navigation }: ScreenProps<'ResetPassword'>) {
  const [email, setEmail] = useState(useSession.getState().profile.email);
  const back = () => navigation.navigate('Login');

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Enter your email to receive password reset instructions"
      headerColor={colors.orangeLight}
      tile
      footer={{ text: 'Already have an account?', link: 'Log In', onPress: back }}
    >
      <Field
        labelStyle={authStyles.label}
        inputStyle={authStyles.input}
        label="Email Address"
        variant="peach"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ marginTop: 20 }}
      />
      <PrimaryButton
        label="Log In"
        onPress={back}
        style={authStyles.submit}
        textStyle={authStyles.submitTxt}
      />
    </AuthShell>
  );
}

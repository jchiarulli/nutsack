import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, View, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { NDKEvent, NostrEvent, useNDK } from '@nostr-dev-kit/ndk-mobile';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk-mobile';
import { nip19 } from 'nostr-tools';
import { Text } from '@/components/nativewindui/Text';
import { Button, ButtonState } from '@/components/nativewindui/Button';
import { QrCode } from 'lucide-react-native';
import { cn } from '@/lib/cn';
// TODO
// Look for ndk-mobile equivalent if needed based on NIP-07 use
// import NDK from '@nostr-dev-kit/ndk';
// TODO
// Look into if this is needed based on NIP-07 use
// import { NDKEvent } from '@nostr-dev-kit/ndk-mobile';
// TODO
// Fix this import path
import { NDKNip55Signer } from '../../../packages/ndk/ndk-mobile/src/providers/ndk/signers/nip55';
import { myFollows } from '@/utils/myfollows';

export default function LoginComponent({ textClassName }: { textClassName?: string }) {
    const [payload, setPayload] = useState<string | undefined>(undefined);
    const { ndk, loginWithPayload } = useNDK();
    const [state, setState] = useState<ButtonState>("idle");

    const handleLogin = async () => {
        if (!ndk) return;
        try {
            await loginWithPayload(payload, { save: true });
        } catch (error) {
            Alert.alert('Error', error.message || 'An error occurred during login');
        }
    };

    const handleLoginWithAmber = async () => {
        try {
            const nip55signer = new NDKNip55Signer();
            const response = await nip55signer.blockUntilReady();
            console.log('NIP-55 response', response);
        } catch (error) {
            Alert.alert('Error', error.message || 'An error occurred during login');
        }

        // if (!ndk) return;
        // try {
        //     await loginWithPayload(payload, { save: true });
        // }
    };

    const createAccount = async () => {
        setState("loading");
        const signer = NDKPrivateKeySigner.generate();
        const nsec = nip19.nsecEncode(signer._privateKey!);
        const user = await signer.user();

        const kind0 = new NDKEvent(ndk, {
            kind: 0, content: JSON.stringify({
                name: 'Hello, Honeypot',
                about: 'A new user trying out Honeypot',
                picture: 'https://kawaii-avatar.now.sh/api/avatar?username=' + user.pubkey

            })
        } as NostrEvent);
        await kind0.sign(signer);
        console.log("kind0 signed");
        await kind0.publish();
        console.log("kind0 published");
        try {
            const kind3 = new NDKEvent(ndk, { kind: 3, tags: myFollows.map(f => ['p', f]) } as NostrEvent);
            await kind3.sign(signer);
            await kind3.publish();
        } catch (e) {
            console.log("failed to publish kind3", e);
            setState("error");
        }
        
        await loginWithPayload(nsec, { save: true })
        setState("success");
    };

    const [scanQR, setScanQR] = useState(false);

    async function handleBarcodeScanned({ data }: { data: string }) {
        setPayload(data.trim());
        setScanQR(false);
        try {
            await loginWithPayload(data.trim(), { save: true });
        } catch (error) {
            Alert.alert('Error', error.message || 'An error occurred during login');
        }
    }

    return (
        <View className="w-full flex-1 flex-col items-center justify-center">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <View className="w-full flex-1 items-stretch justify-center gap-4">
                    {scanQR && (
                        <View
                            style={{
                                borderRadius: 8,
                                height: Dimensions.get('window').width * 0.75,
                                width: Dimensions.get('window').width * 0.75,
                            }}>
                            <CameraView
                                barcodeScannerSettings={{
                                    barcodeTypes: ['qr'],
                                }}
                                style={{ flex: 1, width: '100%', borderRadius: 8 }}
                                onBarcodeScanned={handleBarcodeScanned}
                            />
                        </View>
                    )}

                    <View className="w-full flex-col items-start gap-1">
                        <Text className={cn(textClassName, 'text-base')}>Enter your nsec or bunker:// connection</Text>
                        <TextInput
                            style={styles.input}
                            className={textClassName}
                            multiline
                            autoCapitalize="none"
                            autoComplete={undefined}
                            placeholder="Enter your nsec or bunker:// connection"
                            autoCorrect={false}
                            value={payload}
                            onChangeText={setPayload}
                        />
                    </View>

                    <Button variant="accent" size={Platform.select({ ios: 'lg', default: 'md' })} onPress={handleLogin}>
                        <Text>Login</Text>
                    </Button>

                    <Button variant="accent" size={Platform.select({ ios: 'lg', default: 'md' })} onPress={handleLoginWithAmber}>
                        <Text>Login with Amber</Text>
                    </Button>

                    <Button variant="plain" onPress={createAccount} state={state}>
                        <Text className={textClassName}>New to nostr?</Text>
                    </Button>

                    {!scanQR && (
                        <View className="w-full flex-row justify-center">
                            <Button
                                variant="secondary"
                                onPress={() => {
                                    ndk.signer = undefined;
                                    setScanQR(true);
                                }}
                                className=""
                                style={{ flexDirection: 'column', gap: 8 }}>
                                <QrCode size={64} />
                                <Text className={textClassName}>Scan QR</Text>
                            </Button>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    input: {
        width: '100%',
        height: 100,
        borderColor: 'gray',
        borderWidth: 1,
        borderRadius: 5,
        padding: 10,
    },
    button: {
        textAlign: 'center',
        padding: 20,
        borderRadius: 99,
        marginBottom: 10,
        width: '100%',
    },
    buttonText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
